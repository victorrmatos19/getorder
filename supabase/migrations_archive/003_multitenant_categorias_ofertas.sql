-- ============================================================
-- 637 SaaS — multi-tenancy + categorias + ofertas + novidades
-- Idempotente: pode rodar várias vezes.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabela restaurantes
-- ------------------------------------------------------------
create table if not exists public.restaurantes (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  slug      text not null unique,
  logo_url  text,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Garantir restaurante "637 Cerveja" como tenant padrão
insert into public.restaurantes (nome, slug)
values ('637 Cerveja Artesanal', '637-cerveja')
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- 2) Tabela categorias
-- ------------------------------------------------------------
create table if not exists public.categorias (
  id              uuid primary key default gen_random_uuid(),
  restaurante_id  uuid not null references public.restaurantes(id) on delete cascade,
  nome            text not null,
  emoji           text,
  ordem           integer not null default 0,
  ativa           boolean not null default true,
  criado_em       timestamptz not null default now(),
  unique (restaurante_id, nome)
);

-- ------------------------------------------------------------
-- 3) Adicionar restaurante_id em todas as tabelas (nullable
--    temporariamente para podermos backfill)
-- ------------------------------------------------------------
alter table public.mesas        add column if not exists restaurante_id uuid references public.restaurantes(id);
alter table public.produtos     add column if not exists restaurante_id uuid references public.restaurantes(id);
alter table public.comandas     add column if not exists restaurante_id uuid references public.restaurantes(id);
alter table public.itens_pedido add column if not exists restaurante_id uuid references public.restaurantes(id);
alter table public.perfis       add column if not exists restaurante_id uuid references public.restaurantes(id);

-- ------------------------------------------------------------
-- 4) Novos campos em produtos
-- ------------------------------------------------------------
alter table public.produtos
  add column if not exists categoria_id    uuid references public.categorias(id),
  add column if not exists em_oferta       boolean not null default false,
  add column if not exists novidade        boolean not null default false,
  add column if not exists oferta_preco    numeric(10,2),
  add column if not exists destaque_ordem  integer not null default 999;

-- ------------------------------------------------------------
-- 5) Backfill: anexar tudo ao restaurante "637 Cerveja"
-- ------------------------------------------------------------
do $$
declare
  r_id uuid;
begin
  select id into r_id from public.restaurantes where slug = '637-cerveja';

  update public.mesas        set restaurante_id = r_id where restaurante_id is null;
  update public.produtos     set restaurante_id = r_id where restaurante_id is null;
  update public.comandas     set restaurante_id = r_id where restaurante_id is null;
  update public.itens_pedido set restaurante_id = r_id where restaurante_id is null;
  -- Perfis: somente admin/garcom/cozinha (super_admin fica NULL)
  update public.perfis
     set restaurante_id = r_id
   where restaurante_id is null
     and role in ('admin','garcom','cozinha');

  -- Categorias padrão para o restaurante 637, mantendo emojis do protótipo
  insert into public.categorias (restaurante_id, nome, emoji, ordem)
  values
    (r_id, 'Cervejas', '🍺', 1),
    (r_id, 'Lanches',  '🍔', 2),
    (r_id, 'Drinks',   '🥤', 3),
    (r_id, 'Petiscos', '🍟', 4)
  on conflict (restaurante_id, nome) do nothing;

  -- Vincular produtos existentes às categorias pela coluna legada.
  -- p.categoria pode ser enum; cast para text antes de lower().
  update public.produtos p
     set categoria_id = c.id
    from public.categorias c
   where c.restaurante_id = r_id
     and p.restaurante_id = r_id
     and p.categoria_id is null
     and lower(c.nome) = case lower(p.categoria::text)
                           when 'cervejas' then 'cervejas'
                           when 'lanches'  then 'lanches'
                           when 'drinks'   then 'drinks'
                           when 'petiscos' then 'petiscos'
                           else null
                         end;
end $$;

-- ------------------------------------------------------------
-- 5.1) Migrar produtos.categoria (enum) para text nullable
--      A nova fonte de verdade é categoria_id (FK).
-- ------------------------------------------------------------
do $$
declare
  col_type text;
begin
  select data_type
    into col_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'produtos'
     and column_name  = 'categoria';

  if col_type is not null and col_type <> 'text' then
    execute 'alter table public.produtos
               alter column categoria drop not null,
               alter column categoria type text using categoria::text';
  elsif col_type = 'text' then
    -- já é text, apenas garante que aceita null (ignora se já aceita)
    begin
      execute 'alter table public.produtos alter column categoria drop not null';
    exception when others then null;
    end;
  end if;
end $$;

-- ------------------------------------------------------------
-- 6) Tornar restaurante_id NOT NULL onde aplicável
-- ------------------------------------------------------------
alter table public.mesas        alter column restaurante_id set not null;
alter table public.produtos     alter column restaurante_id set not null;
alter table public.comandas     alter column restaurante_id set not null;
alter table public.itens_pedido alter column restaurante_id set not null;
-- perfis.restaurante_id permanece nullable (super_admin = null)

-- ------------------------------------------------------------
-- 7) Atualizar constraint de role em perfis para incluir super_admin
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'perfis_role_check'
  ) then
    execute 'alter table public.perfis drop constraint perfis_role_check';
  end if;
end $$;

alter table public.perfis
  add constraint perfis_role_check
  check (role in ('super_admin','admin','garcom','cozinha'));

-- ------------------------------------------------------------
-- 8) Índices de performance
-- ------------------------------------------------------------
create index if not exists idx_mesas_restaurante       on public.mesas(restaurante_id);
create index if not exists idx_produtos_restaurante    on public.produtos(restaurante_id);
create index if not exists idx_comandas_restaurante    on public.comandas(restaurante_id);
create index if not exists idx_itens_restaurante       on public.itens_pedido(restaurante_id);
create index if not exists idx_categorias_restaurante  on public.categorias(restaurante_id);
create index if not exists idx_produtos_categoria      on public.produtos(categoria_id);
create index if not exists idx_perfis_restaurante      on public.perfis(restaurante_id);

-- ============================================================
-- 9) FUNÇÕES HELPER
-- ============================================================

-- Substitui a current_role() antiga (se existir)
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.perfis where id = auth.uid()
$$;

create or replace function public.auth_restaurante_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurante_id from public.perfis where id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis
     where id = auth.uid() and role = 'super_admin'
  )
$$;

grant execute on function public.current_role()        to anon, authenticated;
grant execute on function public.auth_restaurante_id() to anon, authenticated;
grant execute on function public.is_super_admin()      to anon, authenticated;

-- ============================================================
-- 10) RLS POLICIES
-- ============================================================
alter table public.restaurantes enable row level security;
alter table public.categorias   enable row level security;
alter table public.mesas        enable row level security;
alter table public.produtos     enable row level security;
alter table public.comandas     enable row level security;
alter table public.itens_pedido enable row level security;
alter table public.perfis       enable row level security;

-- limpa policies antigas (das migrations anteriores)
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('restaurantes','categorias','mesas','produtos','comandas','itens_pedido','perfis')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- ---------------------------------------------
-- restaurantes
-- ---------------------------------------------
-- leitura pública (cliente precisa pegar logo/nome via slug ou via mesa)
create policy restaurantes_select_all on public.restaurantes
  for select using (true);

-- super_admin escreve qualquer
create policy restaurantes_super_admin_write on public.restaurantes
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------
-- categorias
-- ---------------------------------------------
create policy categorias_select_public on public.categorias
  for select using (true);

-- admin do tenant escreve só nas próprias categorias
create policy categorias_admin_write on public.categorias
  for all to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() = 'admin' and restaurante_id = public.auth_restaurante_id())
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'admin' and restaurante_id = public.auth_restaurante_id())
  );

-- ---------------------------------------------
-- mesas
-- ---------------------------------------------
-- cliente lê (precisa para validar a página /mesa/[id])
create policy mesas_select_public on public.mesas
  for select using (true);

create policy mesas_admin_write on public.mesas
  for all to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() = 'admin' and restaurante_id = public.auth_restaurante_id())
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'admin' and restaurante_id = public.auth_restaurante_id())
  );

-- ---------------------------------------------
-- produtos
-- ---------------------------------------------
create policy produtos_select_public on public.produtos
  for select using (true);

create policy produtos_admin_write on public.produtos
  for all to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() = 'admin' and restaurante_id = public.auth_restaurante_id())
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'admin' and restaurante_id = public.auth_restaurante_id())
  );

-- ---------------------------------------------
-- comandas
-- ---------------------------------------------
create policy comandas_select_all on public.comandas
  for select using (true);

-- anon: cliente abre comanda em mesa ativa, status 'aberta', com restaurante_id da mesa
create policy comandas_anon_insert on public.comandas
  for insert to anon
  with check (
    status = 'aberta'
    and exists (
      select 1 from public.mesas m
       where m.id = mesa_id
         and m.ativo = true
         and m.restaurante_id = comandas.restaurante_id
    )
  );

create policy comandas_staff_insert on public.comandas
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.current_role() in ('admin','garcom')
        and restaurante_id = public.auth_restaurante_id())
  );

create policy comandas_staff_update on public.comandas
  for update to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() in ('admin','garcom')
        and restaurante_id = public.auth_restaurante_id())
  )
  with check (
    public.is_super_admin()
    or (public.current_role() in ('admin','garcom')
        and restaurante_id = public.auth_restaurante_id())
  );

create policy comandas_admin_delete on public.comandas
  for delete to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() = 'admin' and restaurante_id = public.auth_restaurante_id())
  );

-- ---------------------------------------------
-- itens_pedido
-- ---------------------------------------------
create policy itens_select_all on public.itens_pedido
  for select using (true);

-- cliente insere item 'novo' em comanda aberta do mesmo restaurante
create policy itens_anon_insert on public.itens_pedido
  for insert to anon
  with check (
    status = 'novo'
    and exists (
      select 1 from public.comandas c
       where c.id = comanda_id
         and c.status = 'aberta'
         and c.restaurante_id = itens_pedido.restaurante_id
    )
  );

create policy itens_staff_insert on public.itens_pedido
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.current_role() in ('admin','garcom','cozinha')
        and restaurante_id = public.auth_restaurante_id())
  );

create policy itens_staff_update on public.itens_pedido
  for update to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() in ('admin','garcom','cozinha')
        and restaurante_id = public.auth_restaurante_id())
  )
  with check (
    public.is_super_admin()
    or (public.current_role() in ('admin','garcom','cozinha')
        and restaurante_id = public.auth_restaurante_id())
  );

create policy itens_admin_delete on public.itens_pedido
  for delete to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() = 'admin' and restaurante_id = public.auth_restaurante_id())
  );

-- ---------------------------------------------
-- perfis
-- ---------------------------------------------
-- usuário lê o próprio perfil; super_admin lê todos; admin do tenant lê seus pares
create policy perfis_select on public.perfis
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_super_admin()
    or (public.current_role() = 'admin' and restaurante_id = public.auth_restaurante_id())
  );

create policy perfis_super_admin_write on public.perfis
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- 11) REALTIME
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'itens_pedido'
  ) then
    alter publication supabase_realtime add table public.itens_pedido;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'comandas'
  ) then
    alter publication supabase_realtime add table public.comandas;
  end if;
end $$;

-- ============================================================
-- 12) STORAGE
-- ============================================================
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do update set public = true;

drop policy if exists "produtos_public_read" on storage.objects;
create policy "produtos_public_read" on storage.objects
  for select using (bucket_id = 'produtos');

drop policy if exists "produtos_admin_insert" on storage.objects;
create policy "produtos_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'produtos'
    and (public.is_super_admin() or public.current_role() = 'admin')
  );

drop policy if exists "produtos_admin_update" on storage.objects;
create policy "produtos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'produtos' and (public.is_super_admin() or public.current_role() = 'admin'))
  with check (bucket_id = 'produtos' and (public.is_super_admin() or public.current_role() = 'admin'));

drop policy if exists "produtos_admin_delete" on storage.objects;
create policy "produtos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'produtos' and (public.is_super_admin() or public.current_role() = 'admin'));
