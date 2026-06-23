-- 016 — Correções de segurança (Discovery Cyber)
-- Lote read→write: fecha a leitura/escrita anônima ampla, centraliza o fluxo do cliente em
-- RPCs SECURITY DEFINER, recomputa o fechamento de comanda no servidor, escopa o Storage por
-- tenant, adiciona auditoria e limites de entrada. NENHUMA mudança visual.
--
-- Achados endereçados:
--   #1 CRÍTICO  RLS: anônimo lia comandas/itens de todos os tenants  → leitura anônima removida
--   #2 ALTO     anônimo inseria item/comanda direto (bypassa RPC)     → INSERT anônimo removido
--   #4 ALTO     flood (comanda por load)                              → abrir_comanda_mesa reusa comanda + throttle
--   #6 MÉDIO    checkout calculava total no client                    → fechar_comanda recomputa no servidor
--   #5 MÉDIO    Storage sem escopo/validação                          → policies por pasta + limites do bucket
--   #9 BAIXO    sem teto de quantidade/obs                            → validação na RPC criar_item_pedido
--  #10 BAIXO    cancelar_comanda_vazia sem checagem de role           → exige admin/garcom
--  #11 BAIXO    sem audit log                                         → tabela auditoria + log nas ações sensíveis

-- ════════════════════════════════════════════════════════════════════════════════════════
-- 1) #1 — Leitura de VENDAS escopada SÓ a staff do tenant (remove a brecha do anônimo).
--    O cliente anonimo passa a ler a propria comanda via RPC get_comanda_cliente (abaixo).
-- ════════════════════════════════════════════════════════════════════════════════════════
drop policy if exists "comandas_select_scoped" on public.comandas;
create policy "comandas_select_scoped" on public.comandas for select using (
  public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

drop policy if exists "itens_select_scoped" on public.itens_pedido;
create policy "itens_select_scoped" on public.itens_pedido for select using (
  public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

drop policy if exists "ipa_select_scoped" on public.itens_pedido_adicionais;
create policy "ipa_select_scoped" on public.itens_pedido_adicionais for select using (
  public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- 2) #2 — Remove o INSERT anônimo direto. Todo pedido/comanda do cliente passa pelas RPCs
--    SECURITY DEFINER (que validam e fazem snapshot no servidor; o owner ignora a RLS).
-- ════════════════════════════════════════════════════════════════════════════════════════
drop policy if exists "itens_anon_insert" on public.itens_pedido;
drop policy if exists "comandas_anon_insert" on public.comandas;

-- ════════════════════════════════════════════════════════════════════════════════════════
-- 3) #11 — Tabela de auditoria (ações sensíveis). Escrita só via funções SECURITY DEFINER.
-- ════════════════════════════════════════════════════════════════════════════════════════
create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  user_id uuid references auth.users(id),
  acao text not null,
  detalhe jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists idx_auditoria_restaurante on public.auditoria(restaurante_id);
alter table public.auditoria enable row level security;

drop policy if exists "auditoria_select_scoped" on public.auditoria;
create policy "auditoria_select_scoped" on public.auditoria for select to authenticated using (
  public.is_super_admin() or (public.current_role() = 'admin' and restaurante_id = public.auth_restaurante_id())
);
-- sem policy de INSERT: a escrita acontece só nas funções SECURITY DEFINER (owner postgres).

-- ════════════════════════════════════════════════════════════════════════════════════════
-- 4) RPCs do fluxo do cliente (anon) — abrir/ler/cancelar a PRÓPRIA comanda.
-- ════════════════════════════════════════════════════════════════════════════════════════

-- 4a) #4 — find-or-create da comanda aberta da mesa (reusa a comanda → não cria a cada load).
create or replace function public.abrir_comanda_mesa(p_mesa_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rest uuid;
  v_ativo boolean;
  v_comanda uuid;
begin
  select restaurante_id, ativo into v_rest, v_ativo from mesas where id = p_mesa_id;
  if v_rest is null or not v_ativo then raise exception 'Mesa indisponível'; end if;

  select id into v_comanda
  from comandas
  where mesa_id = p_mesa_id and status = 'aberta'
  order by criado_em desc
  limit 1;

  if v_comanda is null then
    insert into comandas (mesa_id, restaurante_id, status)
    values (p_mesa_id, v_rest, 'aberta')
    returning id into v_comanda;
  end if;

  return v_comanda;
end;
$$;
alter function public.abrir_comanda_mesa(uuid) owner to postgres;
revoke all on function public.abrir_comanda_mesa(uuid) from public;
grant execute on function public.abrir_comanda_mesa(uuid) to anon, authenticated;

-- 4b) #1 — lê SOMENTE a comanda passada (id + itens + adicionais), sem expor outros tenants.
create or replace function public.get_comanda_cliente(p_comanda_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', c.id,
    'status', c.status,
    'cliente_nome', c.cliente_nome,
    'itens', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'quantidade', i.quantidade,
          'obs', i.obs,
          'status', i.status,
          'criado_em', i.criado_em,
          'preco_base_snapshot', i.preco_base_snapshot,
          'produto', jsonb_build_object('id', p.id, 'nome', p.nome, 'preco', p.preco),
          'adicionais', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', a.id,
                'nome_snapshot', a.nome_snapshot,
                'preco_snapshot', a.preco_snapshot
              ) order by a.criado_em
            )
            from itens_pedido_adicionais a
            where a.item_pedido_id = i.id
          ), '[]'::jsonb)
        ) order by i.criado_em
      )
      from itens_pedido i
      join produtos p on p.id = i.produto_id
      where i.comanda_id = c.id
    ), '[]'::jsonb)
  )
  into result
  from comandas c
  where c.id = p_comanda_id;

  return result; -- null se a comanda não existir
end;
$$;
alter function public.get_comanda_cliente(uuid) owner to postgres;
revoke all on function public.get_comanda_cliente(uuid) from public;
grant execute on function public.get_comanda_cliente(uuid) to anon, authenticated;

-- 4c) cancelamento de item pelo cliente — só item 'novo' da PRÓPRIA comanda (guard de race).
create or replace function public.cancelar_item_cliente(p_comanda_id uuid, p_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
  v_rest uuid;
begin
  update itens_pedido
     set status = 'cancelado', cancelado_em = now()
   where id = p_item_id
     and comanda_id = p_comanda_id
     and status = 'novo'
  returning restaurante_id into v_rest;
  get diagnostics v_n = row_count;

  if v_n > 0 then
    insert into auditoria (restaurante_id, user_id, acao, detalhe)
    values (v_rest, auth.uid(), 'cancelar_item_cliente',
            jsonb_build_object('comanda_id', p_comanda_id, 'item_id', p_item_id));
  end if;

  return v_n > 0;
end;
$$;
alter function public.cancelar_item_cliente(uuid, uuid) owner to postgres;
revoke all on function public.cancelar_item_cliente(uuid, uuid) from public;
grant execute on function public.cancelar_item_cliente(uuid, uuid) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════════════════
-- 5) #9 — criar_item_pedido: mesmos comportamentos + teto de quantidade/obs + anti-flood.
--    (Recriação idempotente; mantém esgotado/anti-tampering/snapshot da 012.)
-- ════════════════════════════════════════════════════════════════════════════════════════
create or replace function public.criar_item_pedido(
  p_comanda_id uuid, p_produto_id uuid, p_quantidade integer, p_observacao text, p_adicional_ids uuid[]
) returns uuid
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_restaurante_id uuid;
  v_comanda_status text;
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

  select preco, disponivel, esgotado into v_preco_base, v_produto_disp, v_produto_esgotado
  from produtos where id = p_produto_id and restaurante_id = v_restaurante_id;
  if v_preco_base is null then raise exception 'Produto inválido'; end if;
  if not v_produto_disp then raise exception 'Produto indisponível'; end if;
  if v_produto_esgotado then raise exception 'Produto esgotado'; end if;
  if p_quantidade is null or p_quantidade < 1 then raise exception 'Quantidade inválida'; end if;
  -- #9 teto de quantidade e tamanho da observação (validação no servidor, não só no front)
  if p_quantidade > 99 then raise exception 'Quantidade máxima por item é 99'; end if;
  if p_observacao is not null and char_length(p_observacao) > 200 then
    raise exception 'Observação muito longa (máx. 200 caracteres)';
  end if;

  -- #4 anti-flood por comanda: no máx. 40 itens criados no último minuto
  select count(*) into v_recentes
  from itens_pedido
  where comanda_id = p_comanda_id and criado_em > now() - interval '1 minute';
  if v_recentes >= 40 then
    raise exception 'Muitos itens em pouco tempo. Aguarde um instante.';
  end if;

  -- Anti-tampering: cada adicional precisa pertencer a um grupo ATIVO vinculado a ESTE produto.
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

-- ════════════════════════════════════════════════════════════════════════════════════════
-- 6) #6 — Fechamento de comanda recomputado no SERVIDOR (não confia no total do client).
-- ════════════════════════════════════════════════════════════════════════════════════════
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

  select restaurante_id, status into v_rest, v_status from comandas where id = p_comanda_id;
  if v_rest is null then raise exception 'Comanda não encontrada'; end if;
  if not public.is_super_admin() and v_rest <> public.auth_restaurante_id() then
    raise exception 'Comanda de outro restaurante';
  end if;
  if v_status <> 'aberta' then raise exception 'Comanda não está aberta'; end if;
  if p_forma_pagamento is null or p_forma_pagamento not in ('pix','debito','credito','dinheiro') then
    raise exception 'Forma de pagamento inválida';
  end if;
  v_pessoas := greatest(coalesce(p_numero_pessoas, 1), 1);

  -- Subtotal recomputado a partir dos snapshots (mesma lógica do lib/calcComanda).
  select coalesce(sum(
    (coalesce(i.preco_base_snapshot, p.preco) + coalesce(ad.soma, 0)) * i.quantidade
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
         fechado_em = now()
   where id = p_comanda_id;

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

-- ════════════════════════════════════════════════════════════════════════════════════════
-- 7) #10 — cancelar_comanda_vazia: exige papel admin/garcom (+ auditoria).
-- ════════════════════════════════════════════════════════════════════════════════════════
create or replace function public.cancelar_comanda_vazia(p_comanda_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_rest uuid;
begin
  if not public.is_super_admin() then
    v_role := public.current_role();
    if v_role is null or v_role not in ('admin','garcom') then raise exception 'Acesso negado'; end if;
  end if;

  update comandas
     set status = 'cancelada',
         cancelada_em = now(),
         cancelada_por = auth.uid(),
         cancelamento_motivo = 'cancelada_garcom'
   where id = p_comanda_id
     and restaurante_id = public.auth_restaurante_id()
     and status = 'aberta'
     and not exists (select 1 from itens_pedido i where i.comanda_id = p_comanda_id)
  returning restaurante_id into v_rest;

  if not found then
    raise exception 'Comanda não pode ser cancelada (inexistente, já fechada ou possui itens).';
  end if;

  insert into auditoria (restaurante_id, user_id, acao, detalhe)
  values (v_rest, auth.uid(), 'cancelar_comanda_vazia', jsonb_build_object('comanda_id', p_comanda_id));
end;
$$;
revoke all on function public.cancelar_comanda_vazia(uuid) from public;
grant execute on function public.cancelar_comanda_vazia(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════════════════
-- 8) #5 — Storage: escopo por pasta do tenant + limites do bucket.
--    Novos uploads vão para `<restaurante_id>/<arquivo>`; a escrita exige a pasta == tenant.
--    Leitura segue pública (bucket público). Fotos antigas na raiz continuam legíveis.
-- ════════════════════════════════════════════════════════════════════════════════════════
update storage.buckets
   set public = true,
       file_size_limit = 2097152, -- 2 MB
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif']
 where id = 'produtos';

drop policy if exists "produtos_public_read" on storage.objects;
drop policy if exists "produtos_auth_insert" on storage.objects;
drop policy if exists "produtos_auth_update" on storage.objects;
drop policy if exists "produtos_auth_delete" on storage.objects;

create policy "produtos_public_read" on storage.objects
  for select using (bucket_id = 'produtos');

create policy "produtos_auth_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'produtos' and (
      public.is_super_admin()
      or (storage.foldername(name))[1] = public.auth_restaurante_id()::text
    )
  );

create policy "produtos_auth_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'produtos' and (
      public.is_super_admin()
      or (storage.foldername(name))[1] = public.auth_restaurante_id()::text
    )
  );

create policy "produtos_auth_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'produtos' and (
      public.is_super_admin()
      or (storage.foldername(name))[1] = public.auth_restaurante_id()::text
    )
  );
