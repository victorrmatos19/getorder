-- 008 — Isolamento multi-tenant na LEITURA das tabelas de VENDA (RLS de SELECT)
--
-- CONTEXTO: as policies de SELECT eram `USING (true)` (leitura pública). O cliente ANÔNIMO do
-- cardápio precisa ler dados de cardápio sem auth, então a leitura pública é necessária PARA O
-- CARDÁPIO. Mas os dados de VENDA (comandas/itens) vazavam entre restaurantes: qualquer staff
-- autenticado lia vendas de todos os tenants (dashboard/garçom/cozinha confiam na RLS).
--
-- DECISÃO (corrigida): escopar por tenant SÓ os dados de VENDA. As tabelas de CARDÁPIO/DISPLAY
-- continuam com leitura pública `using (true)` — são públicas por design (QR do cliente) e o
-- `/mesa/[id]` precisa funcionar para QUALQUER visitante (anônimo OU logado em outro tenant).
-- Escopar o cardápio quebrava o cliente logado em outro tenant ("Mesa indisponível").
--
-- Escrita (INSERT/UPDATE/DELETE) não muda: já tem tenant_isolation / anon_insert; o
-- restaurante_id das escritas de admin é carimbado pelo trigger force_tenant_on_write (009).

-- ── Cardápio / display: leitura PÚBLICA (restaura o comportamento original) ──
-- (cliente anônimo e logado-de-qualquer-tenant montam o cardápio; dados não sensíveis)

-- categorias
drop policy if exists "categorias_select_public" on public.categorias;
drop policy if exists "categorias_select_scoped" on public.categorias;
create policy "categorias_select_public" on public.categorias for select using (true);

-- mesas
drop policy if exists "mesas_select_public" on public.mesas;
drop policy if exists "mesas_select_scoped" on public.mesas;
create policy "mesas_select_public" on public.mesas for select using (true);

-- produtos
drop policy if exists "produtos_select_public" on public.produtos;
drop policy if exists "produtos_select_scoped" on public.produtos;
create policy "produtos_select_public" on public.produtos for select using (true);

-- horarios_funcionamento
drop policy if exists "horarios_select_public" on public.horarios_funcionamento;
drop policy if exists "horarios_select_scoped" on public.horarios_funcionamento;
create policy "horarios_select_public" on public.horarios_funcionamento for select using (true);

-- grupos_adicionais
drop policy if exists "public_read_grupos" on public.grupos_adicionais;
drop policy if exists "grupos_select_scoped" on public.grupos_adicionais;
create policy "grupos_select_public" on public.grupos_adicionais for select using (true);

-- adicionais
drop policy if exists "public_read_adicionais" on public.adicionais;
drop policy if exists "adicionais_select_scoped" on public.adicionais;
create policy "adicionais_select_public" on public.adicionais for select using (true);

-- produtos_grupos
drop policy if exists "public_read_produtos_grupos" on public.produtos_grupos;
drop policy if exists "produtos_grupos_select_scoped" on public.produtos_grupos;
create policy "produtos_grupos_select_public" on public.produtos_grupos for select using (true);

-- restaurantes (nome/slug/taxa/pausa — tudo já exibido no cardápio público)
drop policy if exists "restaurantes_select_all" on public.restaurantes;
drop policy if exists "restaurantes_select_scoped" on public.restaurantes;
create policy "restaurantes_select_public" on public.restaurantes for select using (true);

-- ── Vendas: leitura ESCOPADA por tenant (fecha o vazamento de dashboard/garçom/cozinha) ──
--   * cliente ANÔNIMO (acompanha a própria comanda): `auth.uid() is null`
--   * super admin: tudo
--   * staff autenticado: só o próprio restaurante

-- comandas
drop policy if exists "comandas_select_all" on public.comandas;
drop policy if exists "comandas_select_scoped" on public.comandas;
create policy "comandas_select_scoped" on public.comandas for select using (
  auth.uid() is null or public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

-- itens_pedido
drop policy if exists "itens_select_all" on public.itens_pedido;
drop policy if exists "itens_select_scoped" on public.itens_pedido;
create policy "itens_select_scoped" on public.itens_pedido for select using (
  auth.uid() is null or public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);

-- itens_pedido_adicionais
drop policy if exists "public_read_ipa" on public.itens_pedido_adicionais;
drop policy if exists "ipa_select_scoped" on public.itens_pedido_adicionais;
create policy "ipa_select_scoped" on public.itens_pedido_adicionais for select using (
  auth.uid() is null or public.is_super_admin() or restaurante_id = public.auth_restaurante_id()
);
