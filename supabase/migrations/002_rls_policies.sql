-- ============================================================
-- RLS POLICIES — 637 Cervejaria
-- Seguro rodar várias vezes (drop policy if exists antes).
-- ============================================================

-- Helper: descobre a role de um usuário autenticado.
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.perfis where id = auth.uid()
$$;

grant execute on function public.current_role() to anon, authenticated;

-- Habilita RLS em todas as tabelas
alter table public.mesas        enable row level security;
alter table public.produtos     enable row level security;
alter table public.comandas     enable row level security;
alter table public.itens_pedido enable row level security;
alter table public.perfis       enable row level security;

-- ============================================================
-- MESAS — clientes leem (para validar /mesa/[id]); admin escreve
-- ============================================================
drop policy if exists mesas_select_all on public.mesas;
create policy mesas_select_all on public.mesas
  for select using (true);

drop policy if exists mesas_admin_write on public.mesas;
create policy mesas_admin_write on public.mesas
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ============================================================
-- PRODUTOS — todos leem o cardápio; admin escreve
-- ============================================================
drop policy if exists produtos_select_all on public.produtos;
create policy produtos_select_all on public.produtos
  for select using (true);

drop policy if exists produtos_admin_write on public.produtos;
create policy produtos_admin_write on public.produtos
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ============================================================
-- COMANDAS
-- - cliente (anon) cria comanda em mesa ativa, com status 'aberta'
-- - cliente lê (necessário para checar localStorage)
-- - staff (admin/garcom) escreve (fechar comanda)
-- ============================================================
drop policy if exists comandas_select_all on public.comandas;
create policy comandas_select_all on public.comandas
  for select using (true);

drop policy if exists comandas_anon_insert on public.comandas;
create policy comandas_anon_insert on public.comandas
  for insert to anon
  with check (
    status = 'aberta'
    and exists (select 1 from public.mesas m where m.id = mesa_id and m.ativo = true)
  );

drop policy if exists comandas_staff_insert on public.comandas;
create policy comandas_staff_insert on public.comandas
  for insert to authenticated
  with check (public.current_role() in ('admin','garcom'));

drop policy if exists comandas_staff_update on public.comandas;
create policy comandas_staff_update on public.comandas
  for update to authenticated
  using (public.current_role() in ('admin','garcom'))
  with check (public.current_role() in ('admin','garcom'));

drop policy if exists comandas_admin_delete on public.comandas;
create policy comandas_admin_delete on public.comandas
  for delete to authenticated
  using (public.current_role() = 'admin');

-- ============================================================
-- ITENS_PEDIDO
-- - cliente (anon) insere itens em comanda aberta, sempre status 'novo'
-- - todos leem (cliente vê os próprios itens, staff vê tudo)
-- - staff atualiza status (cozinha/garcom)
-- ============================================================
drop policy if exists itens_select_all on public.itens_pedido;
create policy itens_select_all on public.itens_pedido
  for select using (true);

drop policy if exists itens_anon_insert on public.itens_pedido;
create policy itens_anon_insert on public.itens_pedido
  for insert to anon
  with check (
    status = 'novo'
    and exists (
      select 1 from public.comandas c
      where c.id = comanda_id and c.status = 'aberta'
    )
  );

drop policy if exists itens_staff_insert on public.itens_pedido;
create policy itens_staff_insert on public.itens_pedido
  for insert to authenticated
  with check (public.current_role() in ('admin','garcom','cozinha'));

drop policy if exists itens_staff_update on public.itens_pedido;
create policy itens_staff_update on public.itens_pedido
  for update to authenticated
  using (public.current_role() in ('admin','garcom','cozinha'))
  with check (public.current_role() in ('admin','garcom','cozinha'));

drop policy if exists itens_admin_delete on public.itens_pedido;
create policy itens_admin_delete on public.itens_pedido
  for delete to authenticated
  using (public.current_role() = 'admin');

-- ============================================================
-- PERFIS — usuário lê o próprio perfil; admin lê todos
-- ============================================================
drop policy if exists perfis_self_select on public.perfis;
create policy perfis_self_select on public.perfis
  for select to authenticated
  using (id = auth.uid() or public.current_role() = 'admin');

drop policy if exists perfis_admin_write on public.perfis;
create policy perfis_admin_write on public.perfis
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ============================================================
-- REALTIME — habilitar para itens_pedido e comandas (idempotente)
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
-- STORAGE — bucket "produtos" precisa existir como público
-- e ter policies para upload/delete por admin
-- ============================================================

-- Cria o bucket (idempotente)
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do update set public = true;

-- Leitura pública (qualquer um vê as fotos)
drop policy if exists "produtos_public_read" on storage.objects;
create policy "produtos_public_read" on storage.objects
  for select using (bucket_id = 'produtos');

-- Upload apenas para admin
drop policy if exists "produtos_admin_insert" on storage.objects;
create policy "produtos_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'produtos'
    and public.current_role() = 'admin'
  );

-- Update apenas para admin
drop policy if exists "produtos_admin_update" on storage.objects;
create policy "produtos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'produtos' and public.current_role() = 'admin')
  with check (bucket_id = 'produtos' and public.current_role() = 'admin');

-- Delete apenas para admin
drop policy if exists "produtos_admin_delete" on storage.objects;
create policy "produtos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'produtos' and public.current_role() = 'admin');
