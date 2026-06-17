-- 010 — Policies de Storage do bucket `produtos` (versionar o que só existia no painel do PRD)
--
-- CONTEXTO: o bucket `produtos` é público (download via URL pública), mas `storage.objects` tem
-- RLS habilitado e o baseline NÃO inclui o schema `storage`. Logo, no ambiente LOCAL não há
-- policy de escrita → o upload de foto pelo admin falha (RLS). No PRD as policies existem (criadas
-- no painel) mas não estavam versionadas. Esta migration fecha o gap e habilita upload local.
--
-- Fotos são imagens PÚBLICAS de cardápio; o path é só `<uuid>.<ext>` (sem isolamento por tenant),
-- então uma policy por `bucket_id` basta. Leitura pública (bucket público) + escrita autenticada.
--
-- ⚠️ Antes do `db push`: conferir no painel do PRD (Storage → Policies) se já existem policies
-- equivalentes para não duplicar — alinhar nomes/condições se necessário.

drop policy if exists "produtos_public_read" on storage.objects;
drop policy if exists "produtos_auth_insert" on storage.objects;
drop policy if exists "produtos_auth_update" on storage.objects;
drop policy if exists "produtos_auth_delete" on storage.objects;

create policy "produtos_public_read" on storage.objects
  for select using (bucket_id = 'produtos');

create policy "produtos_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'produtos');

create policy "produtos_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'produtos');

create policy "produtos_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'produtos');
