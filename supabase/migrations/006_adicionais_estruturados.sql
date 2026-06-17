-- 006 — Adicionais estruturados (grupos de opções reutilizáveis entre produtos)
-- Fase 1 de 3: camada de dados (tabelas + RLS + RPC). Sem UI.
--
-- Modelo: grupos reutilizáveis de opções ("Ponto da carne", "Tirar", "Adicionais").
-- "Tirar" e "adicionar" usam o MESMO mecanismo; uma remoção é só uma opção de preço 0.
-- Snapshot de nome E preço no momento do pedido (histórico imutável).
-- TODO cálculo/validação de preço acontece no BACKEND (RPC security definer abaixo).

-- ============================================================
-- 1) TABELAS
-- ============================================================

-- Grupos reutilizáveis de opções
create table grupos_adicionais (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  nome text not null,
  selecao text not null check (selecao in ('unica','multipla')),
  obrigatorio boolean not null default false,
  min_escolhas int not null default 0,
  max_escolhas int,                 -- null = sem teto
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Opções dentro de um grupo
create table adicionais (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  grupo_id uuid not null references grupos_adicionais(id) on delete cascade,
  nome text not null,
  preco numeric(10,2) not null default 0,
  disponivel boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

-- Junção: quais grupos se aplicam a quais produtos
create table produtos_grupos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete cascade,
  grupo_id uuid not null references grupos_adicionais(id) on delete cascade,
  ordem int not null default 0,
  unique (produto_id, grupo_id)
);

-- Snapshot dos adicionais escolhidos em cada item do pedido
create table itens_pedido_adicionais (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  item_pedido_id uuid not null references itens_pedido(id) on delete cascade,
  adicional_id uuid references adicionais(id) on delete set null,
  grupo_nome_snapshot text,
  nome_snapshot text not null,
  preco_snapshot numeric(10,2) not null default 0,
  criado_em timestamptz not null default now()
);

-- Snapshot do preço base do produto no momento do pedido
alter table itens_pedido
  add column if not exists preco_base_snapshot numeric(10,2);

-- ============================================================
-- 2) ÍNDICES (restaurante_id e FKs)
-- ============================================================
create index idx_grupos_adicionais_restaurante on grupos_adicionais(restaurante_id);
create index idx_adicionais_restaurante on adicionais(restaurante_id);
create index idx_adicionais_grupo on adicionais(grupo_id);
create index idx_produtos_grupos_restaurante on produtos_grupos(restaurante_id);
create index idx_produtos_grupos_produto on produtos_grupos(produto_id);
create index idx_produtos_grupos_grupo on produtos_grupos(grupo_id);
create index idx_ipa_restaurante on itens_pedido_adicionais(restaurante_id);
create index idx_ipa_item on itens_pedido_adicionais(item_pedido_id);

-- ============================================================
-- 3) RLS
-- ============================================================
alter table grupos_adicionais enable row level security;
alter table adicionais enable row level security;
alter table produtos_grupos enable row level security;
alter table itens_pedido_adicionais enable row level security;

-- tenant_isolation (staff vê só do próprio restaurante; super_admin vê tudo)
create policy tenant_isolation on grupos_adicionais
  using (is_super_admin() or restaurante_id = auth_restaurante_id())
  with check (is_super_admin() or restaurante_id = auth_restaurante_id());
create policy tenant_isolation on adicionais
  using (is_super_admin() or restaurante_id = auth_restaurante_id())
  with check (is_super_admin() or restaurante_id = auth_restaurante_id());
create policy tenant_isolation on produtos_grupos
  using (is_super_admin() or restaurante_id = auth_restaurante_id())
  with check (is_super_admin() or restaurante_id = auth_restaurante_id());
create policy tenant_isolation on itens_pedido_adicionais
  using (is_super_admin() or restaurante_id = auth_restaurante_id())
  with check (is_super_admin() or restaurante_id = auth_restaurante_id());

-- Leitura pública (cliente anônimo em /mesa precisa renderizar as opções
-- e ver os adicionais da própria comanda). Espelha o padrão public_read_*.
create policy public_read_grupos on grupos_adicionais
  for select using (true);
create policy public_read_adicionais on adicionais
  for select using (true);
create policy public_read_produtos_grupos on produtos_grupos
  for select using (true);
create policy public_read_ipa on itens_pedido_adicionais
  for select using (true);

-- NÃO criar policy de insert público em itens_pedido_adicionais:
-- a escrita acontece SÓ pela RPC abaixo (security definer).

-- ============================================================
-- 4) RPC: criação de item de pedido (preço + validação no servidor)
-- ============================================================
-- Única forma de inserir item de pedido a partir do fluxo do cliente.
-- SECURITY DEFINER: ignora RLS, então valida o tenant resolvendo
-- restaurante_id a partir da comanda.
create or replace function criar_item_pedido(
  p_comanda_id uuid,
  p_produto_id uuid,
  p_quantidade int,
  p_observacao text,
  p_adicional_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurante_id uuid;
  v_comanda_status text;
  v_preco_base numeric(10,2);
  v_produto_disp boolean;
  v_item_id uuid;
  r_grupo record;
  v_count int;
begin
  select restaurante_id, status into v_restaurante_id, v_comanda_status
  from comandas where id = p_comanda_id;
  if v_restaurante_id is null then raise exception 'Comanda não encontrada'; end if;
  if v_comanda_status <> 'aberta' then raise exception 'Comanda não está aberta'; end if;

  select preco, disponivel into v_preco_base, v_produto_disp
  from produtos where id = p_produto_id and restaurante_id = v_restaurante_id;
  if v_preco_base is null then raise exception 'Produto inválido'; end if;
  if not v_produto_disp then raise exception 'Produto indisponível'; end if;
  if p_quantidade is null or p_quantidade < 1 then raise exception 'Quantidade inválida'; end if;

  -- Anti-tampering: todo adicional escolhido tem que pertencer a um grupo
  -- vinculado a ESTE produto, do mesmo restaurante, e estar disponível.
  if p_adicional_ids is not null and array_length(p_adicional_ids,1) > 0 then
    if exists (
      select 1 from unnest(p_adicional_ids) aid
      where not exists (
        select 1 from adicionais a
        join produtos_grupos pg on pg.grupo_id = a.grupo_id
        where a.id = aid
          and a.restaurante_id = v_restaurante_id
          and a.disponivel = true
          and pg.produto_id = p_produto_id
      )
    ) then raise exception 'Adicional inválido para este produto'; end if;
  end if;

  -- Validação das regras de cada grupo vinculado ao produto
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

  -- Insere item com snapshot do preço base
  insert into itens_pedido
    (restaurante_id, comanda_id, produto_id, quantidade, observacao, status, preco_base_snapshot)
  values
    (v_restaurante_id, p_comanda_id, p_produto_id, p_quantidade,
     nullif(p_observacao,''), 'novo', v_preco_base)
  returning id into v_item_id;

  -- Snapshot dos adicionais (lê preço REAL do banco, ignora qualquer preço do client)
  insert into itens_pedido_adicionais
    (restaurante_id, item_pedido_id, adicional_id, grupo_nome_snapshot, nome_snapshot, preco_snapshot)
  select v_restaurante_id, v_item_id, a.id, g.nome, a.nome, a.preco
  from adicionais a
  join grupos_adicionais g on g.id = a.grupo_id
  where a.id = any(coalesce(p_adicional_ids,'{}'));

  return v_item_id;
end;
$$;

grant execute on function criar_item_pedido(uuid, uuid, int, text, uuid[])
  to anon, authenticated;
