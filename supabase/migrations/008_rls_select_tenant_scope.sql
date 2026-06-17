-- 008 — Isolamento multi-tenant na LEITURA (RLS de SELECT)
--
-- BUG: as policies de SELECT das tabelas operacionais eram `USING (true)` (leitura pública
-- necessária para o cliente ANÔNIMO renderizar o cardápio). Efeito colateral: a RLS não
-- isolava leitura entre restaurantes — qualquer usuário autenticado lia dados de todos os
-- tenants. Telas de staff que confiam na RLS (dashboard, garçom, cozinha) vazavam dados de
-- outros restaurantes.
--
-- FIX: trocar cada SELECT `USING (true)` por uma condição que:
--   * preserva a leitura ANÔNIMA (cliente do cardápio): `auth.uid() is null`
--   * deixa o super_admin ver tudo: `is_super_admin()`
--   * escopa o STAFF ao próprio restaurante: `restaurante_id = auth_restaurante_id()`
-- INSERT/UPDATE/DELETE não mudam (já têm tenant_isolation / anon_insert corretos).

-- Helper de condição (inline em cada policy):
--   auth.uid() is null OR public.is_super_admin() OR restaurante_id = public.auth_restaurante_id()

-- categorias
drop policy if exists "categorias_select_public" on public.categorias;
create policy "categorias_select_scoped" on public.categorias for select using (
  auth.uid() is null or public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

-- mesas
drop policy if exists "mesas_select_public" on public.mesas;
create policy "mesas_select_scoped" on public.mesas for select using (
  auth.uid() is null or public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

-- produtos
drop policy if exists "produtos_select_public" on public.produtos;
create policy "produtos_select_scoped" on public.produtos for select using (
  auth.uid() is null or public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

-- comandas
drop policy if exists "comandas_select_all" on public.comandas;
create policy "comandas_select_scoped" on public.comandas for select using (
  auth.uid() is null or public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

-- itens_pedido
drop policy if exists "itens_select_all" on public.itens_pedido;
create policy "itens_select_scoped" on public.itens_pedido for select using (
  auth.uid() is null or public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

-- horarios_funcionamento
drop policy if exists "horarios_select_public" on public.horarios_funcionamento;
create policy "horarios_select_scoped" on public.horarios_funcionamento for select using (
  auth.uid() is null or public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

-- grupos_adicionais
drop policy if exists "public_read_grupos" on public.grupos_adicionais;
create policy "grupos_select_scoped" on public.grupos_adicionais for select using (
  auth.uid() is null or public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

-- adicionais
drop policy if exists "public_read_adicionais" on public.adicionais;
create policy "adicionais_select_scoped" on public.adicionais for select using (
  auth.uid() is null or public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

-- produtos_grupos
drop policy if exists "public_read_produtos_grupos" on public.produtos_grupos;
create policy "produtos_grupos_select_scoped" on public.produtos_grupos for select using (
  auth.uid() is null or public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

-- itens_pedido_adicionais
drop policy if exists "public_read_ipa" on public.itens_pedido_adicionais;
create policy "ipa_select_scoped" on public.itens_pedido_adicionais for select using (
  auth.uid() is null or public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

-- restaurantes (sem coluna restaurante_id: usar id)
drop policy if exists "restaurantes_select_all" on public.restaurantes;
create policy "restaurantes_select_scoped" on public.restaurantes for select using (
  auth.uid() is null or public.is_super_admin() or id = public.auth_restaurante_id()
);
