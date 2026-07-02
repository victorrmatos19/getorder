-- 022 — Bounds de input no SERVIDOR (auditoria seg/perf do app nativo, item 7).
-- O client (web e app) já limita obs ≤200, quantidade 1–99 e pessoas 1–20, mas uma chamada
-- direta à API com token de staff ignorava os tetos. criar_item_pedido JÁ valida qtd/obs
-- (016/020); faltava o teto de numero_pessoas em fechar_comanda + constraints de defesa.
--
-- CHECKs entram como NOT VALID: valem para escritas novas sem travar em linhas legadas
-- (PRD) nem no db:push. Idempotente.

-- ── 1) fechar_comanda: teto de numero_pessoas (espelha o stepper 1–20 do client) ─────────
-- Igual à 020, mudando SÓ a validação de p_numero_pessoas (antes: floor 1, sem teto).
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

  -- Bounds no servidor (auditoria item 7): espelha o stepper do client (1–20).
  if p_numero_pessoas is not null and (p_numero_pessoas < 1 or p_numero_pessoas > 20) then
    raise exception 'Número de pessoas inválido (1–20)';
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

-- ── 2) CHECK constraints de defesa (NOT VALID: só escritas novas; não trava legado) ──────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'itens_pedido_quantidade_bounds') then
    alter table public.itens_pedido
      add constraint itens_pedido_quantidade_bounds
      check (quantidade >= 1 and quantidade <= 99) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'itens_pedido_obs_len') then
    alter table public.itens_pedido
      add constraint itens_pedido_obs_len
      check (obs is null or char_length(obs) <= 200) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comandas_numero_pessoas_bounds') then
    alter table public.comandas
      add constraint comandas_numero_pessoas_bounds
      check (numero_pessoas >= 1 and numero_pessoas <= 20) not valid;
  end if;
end$$;
