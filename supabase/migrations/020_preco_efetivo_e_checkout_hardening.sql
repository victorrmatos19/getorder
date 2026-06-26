-- 020 — Preço efetivo (oferta) no snapshot + endurecimento do fechamento transacional.
-- Resolve dois bugs acoplados do mesmo fluxo:
--   • "preço de oferta não respeitado fora do cardápio": criar_item_pedido fazia snapshot de
--     produtos.preco CRU, ignorando em_oferta/oferta_preco → anunciado ≠ cobrado.
--   • "Checkout transacional": fechar_comanda já recalcula no servidor (016), mas faltava
--     lock (double-close), guard de comanda vazia, status guard no UPDATE e auditoria fechado_por.
-- Idempotente (create or replace). Não altera grants (preservados).

-- ── 1) Auditoria de fechamento: quem fechou ──────────────────────────────────────────────
alter table public.comandas
  add column if not exists fechado_por uuid references auth.users(id);

-- ── 2) criar_item_pedido: snapshot do PREÇO EFETIVO (aplica a oferta no servidor) ─────────
-- Igual ao 016, mudando SÓ a resolução do preço base (mantém guard de 'aberta', anti-tampering
-- de adicionais, validação de grupos, anti-flood e tetos). lancar_pedido_garcom delega a esta.
create or replace function public.criar_item_pedido(
  p_comanda_id uuid, p_produto_id uuid, p_quantidade integer, p_observacao text, p_adicional_ids uuid[]
) returns uuid
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_restaurante_id uuid;
  v_comanda_status text;
  v_preco numeric(10,2);
  v_oferta_preco numeric(10,2);
  v_em_oferta boolean;
  v_preco_base numeric(10,2);
  v_produto_disp boolean;
  v_produto_esgotado boolean;
  v_item_id uuid;
  r_grupo record;
  v_count int;
  v_recentes int;
begin
  select restaurante_id, status into v_restaurante_id, v_comanda_status
  from comandas where id = p_comanda_id;
  if v_restaurante_id is null then raise exception 'Comanda não encontrada'; end if;
  if v_comanda_status <> 'aberta' then raise exception 'Comanda não está aberta'; end if;

  select preco, oferta_preco, em_oferta, disponivel, esgotado
    into v_preco, v_oferta_preco, v_em_oferta, v_produto_disp, v_produto_esgotado
  from produtos where id = p_produto_id and restaurante_id = v_restaurante_id;
  if v_preco is null then raise exception 'Produto inválido'; end if;
  if not v_produto_disp then raise exception 'Produto indisponível'; end if;
  if v_produto_esgotado then raise exception 'Produto esgotado'; end if;

  -- PREÇO EFETIVO: respeita a oferta (anunciado = cobrado). O snapshot mantém a imutabilidade:
  -- ofertas futuras/retiradas não mexem em pedidos antigos.
  v_preco_base := case
                    when v_em_oferta and v_oferta_preco is not null then v_oferta_preco
                    else v_preco
                  end;

  if p_quantidade is null or p_quantidade < 1 then raise exception 'Quantidade inválida'; end if;
  if p_quantidade > 99 then raise exception 'Quantidade máxima por item é 99'; end if;
  if p_observacao is not null and char_length(p_observacao) > 200 then
    raise exception 'Observação muito longa (máx. 200 caracteres)';
  end if;

  select count(*) into v_recentes
  from itens_pedido
  where comanda_id = p_comanda_id and criado_em > now() - interval '1 minute';
  if v_recentes >= 40 then
    raise exception 'Muitos itens em pouco tempo. Aguarde um instante.';
  end if;

  if p_adicional_ids is not null and array_length(p_adicional_ids,1) > 0 then
    if exists (
      select 1 from unnest(p_adicional_ids) aid
      where not exists (
        select 1 from adicionais a
        join grupos_adicionais g on g.id = a.grupo_id
        join produtos_grupos pg on pg.grupo_id = a.grupo_id
        where a.id = aid
          and a.restaurante_id = v_restaurante_id
          and a.disponivel = true
          and g.ativo = true
          and pg.produto_id = p_produto_id
      )
    ) then raise exception 'Adicional inválido para este produto'; end if;
  end if;

  for r_grupo in
    select g.id, g.nome, g.selecao, g.obrigatorio, g.min_escolhas, g.max_escolhas
    from produtos_grupos pg
    join grupos_adicionais g on g.id = pg.grupo_id
    where pg.produto_id = p_produto_id and g.ativo and g.restaurante_id = v_restaurante_id
  loop
    select count(*) into v_count
    from adicionais a
    where a.grupo_id = r_grupo.id and a.id = any(coalesce(p_adicional_ids,'{}'));

    if r_grupo.obrigatorio and v_count < greatest(r_grupo.min_escolhas,1) then
      raise exception 'Grupo obrigatório sem seleção: %', r_grupo.nome; end if;
    if v_count < r_grupo.min_escolhas then
      raise exception 'Mínimo de escolhas não atingido em: %', r_grupo.nome; end if;
    if r_grupo.selecao = 'unica' and v_count > 1 then
      raise exception 'Apenas uma escolha permitida em: %', r_grupo.nome; end if;
    if r_grupo.max_escolhas is not null and v_count > r_grupo.max_escolhas then
      raise exception 'Máximo de escolhas excedido em: %', r_grupo.nome; end if;
  end loop;

  insert into itens_pedido
    (restaurante_id, comanda_id, produto_id, quantidade, obs, status, preco_base_snapshot)
  values
    (v_restaurante_id, p_comanda_id, p_produto_id, p_quantidade,
     nullif(p_observacao,''), 'novo', v_preco_base)
  returning id into v_item_id;

  insert into itens_pedido_adicionais
    (restaurante_id, item_pedido_id, adicional_id, grupo_nome_snapshot, nome_snapshot, preco_snapshot)
  select v_restaurante_id, v_item_id, a.id, g.nome, a.nome, a.preco
  from adicionais a
  join grupos_adicionais g on g.id = a.grupo_id
  where a.id = any(coalesce(p_adicional_ids,'{}'));

  return v_item_id;
end;
$$;
alter function public.criar_item_pedido(uuid, uuid, integer, text, uuid[]) owner to postgres;

-- ── 3) fechar_comanda: endurecimento transacional ────────────────────────────────────────
-- Igual ao 016 + lock `for update` (double-close), guard de comanda vazia, status guard no
-- UPDATE e `fechado_por`. Subtotal a partir dos snapshots (já corretos após o fix acima);
-- o fallback legado também respeita a oferta. plpgsql = transação única (rollback em erro).
create or replace function public.fechar_comanda(
  p_comanda_id uuid, p_forma_pagamento text, p_taxa_aplicada boolean, p_numero_pessoas integer
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rest uuid;
  v_status text;
  v_role text;
  v_itens int;
  v_subtotal numeric(12,2);
  v_taxa_pct numeric(5,2);
  v_taxa_obrig boolean;
  v_aplicar boolean;
  v_servico numeric(12,2);
  v_total numeric(12,2);
  v_pessoas integer;
begin
  if not public.is_super_admin() then
    v_role := public.current_role();
    if v_role is null or v_role not in ('admin','garcom') then raise exception 'Acesso negado'; end if;
  end if;

  -- LOCK da comanda (fecha a janela de double-close) + valida tenant/status.
  select restaurante_id, status into v_rest, v_status
  from comandas where id = p_comanda_id for update;
  if v_rest is null then raise exception 'Comanda não encontrada'; end if;
  if not public.is_super_admin() and v_rest <> public.auth_restaurante_id() then
    raise exception 'Comanda de outro restaurante';
  end if;
  if v_status <> 'aberta' then raise exception 'Comanda já fechada'; end if;
  if p_forma_pagamento is null or p_forma_pagamento not in ('pix','debito','credito','dinheiro') then
    raise exception 'Forma de pagamento inválida';
  end if;

  -- Comanda vazia (0 itens não-cancelados) → bloqueia e orienta o cancelamento.
  select count(*) into v_itens from itens_pedido
   where comanda_id = p_comanda_id and status <> 'cancelado';
  if v_itens = 0 then
    raise exception 'Comanda sem itens. Use o cancelamento em vez do fechamento.';
  end if;

  v_pessoas := greatest(coalesce(p_numero_pessoas, 1), 1);

  -- Subtotal a partir dos snapshots (preço efetivo já gravado). Fallback legado respeita a oferta.
  select coalesce(sum(
    (coalesce(i.preco_base_snapshot,
              case when p.em_oferta and p.oferta_preco is not null then p.oferta_preco else p.preco end)
     + coalesce(ad.soma, 0)) * i.quantidade
  ), 0)
  into v_subtotal
  from itens_pedido i
  join produtos p on p.id = i.produto_id
  left join lateral (
    select sum(a.preco_snapshot) as soma
    from itens_pedido_adicionais a
    where a.item_pedido_id = i.id
  ) ad on true
  where i.comanda_id = p_comanda_id and i.status <> 'cancelado';

  select taxa_servico_percentual, taxa_servico_obrigatoria
    into v_taxa_pct, v_taxa_obrig
  from restaurantes where id = v_rest;

  v_aplicar := v_taxa_obrig or coalesce(p_taxa_aplicada, true);
  v_servico := case when v_aplicar then round(v_subtotal * (coalesce(v_taxa_pct,0) / 100), 2) else 0 end;
  v_total   := v_subtotal + v_servico;

  update comandas
     set status = 'fechada',
         forma_pagamento = p_forma_pagamento,
         total = v_total,
         taxa_servico_valor = v_servico,
         taxa_servico_aplicada = v_aplicar,
         numero_pessoas = v_pessoas,
         fechado_em = now(),
         fechado_por = auth.uid()
   where id = p_comanda_id and status = 'aberta';

  update itens_pedido
     set status = 'entregue'
   where comanda_id = p_comanda_id and status <> 'cancelado';

  insert into auditoria (restaurante_id, user_id, acao, detalhe)
  values (v_rest, auth.uid(), 'fechar_comanda',
          jsonb_build_object('comanda_id', p_comanda_id, 'total', v_total,
                             'forma_pagamento', p_forma_pagamento, 'servico', v_servico));

  return v_total;
end;
$$;
alter function public.fechar_comanda(uuid, text, boolean, integer) owner to postgres;
revoke all on function public.fechar_comanda(uuid, text, boolean, integer) from public;
grant execute on function public.fechar_comanda(uuid, text, boolean, integer) to authenticated;
