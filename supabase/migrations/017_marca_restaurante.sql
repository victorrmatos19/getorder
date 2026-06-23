-- 017 — White-label: marca por restaurante (cores + bucket de logos)
-- Cada restaurante pode definir cor primária + accent (hex) e um logo próprio.
-- Opt-in: colunas nulas = paleta padrão GetOrder. A escrita já é coberta pela policy
-- restaurantes_admin_update (011); aqui só adicionamos colunas + storage isolado por tenant.

-- 1) Colunas de cor (nullable) + validação de formato hex no servidor.
alter table public.restaurantes
  add column if not exists cor_primaria text,
  add column if not exists cor_accent text;

alter table public.restaurantes drop constraint if exists restaurantes_cor_primaria_hex;
alter table public.restaurantes
  add constraint restaurantes_cor_primaria_hex
  check (cor_primaria is null or cor_primaria ~* '^#[0-9a-f]{6}$');

alter table public.restaurantes drop constraint if exists restaurantes_cor_accent_hex;
alter table public.restaurantes
  add constraint restaurantes_cor_accent_hex
  check (cor_accent is null or cor_accent ~* '^#[0-9a-f]{6}$');

-- 2) Bucket `logos` (público para leitura, isolado por tenant na escrita), espelhando
--    o padrão do bucket `produtos` (migration 016). Upsert para funcionar com/sem o bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3) Policies do bucket `logos`: leitura pública; escrita só na pasta <restaurante_id>/.
drop policy if exists "logos_public_read" on storage.objects;
drop policy if exists "logos_auth_insert" on storage.objects;
drop policy if exists "logos_auth_update" on storage.objects;
drop policy if exists "logos_auth_delete" on storage.objects;

create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');

create policy "logos_auth_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'logos' and (
      public.is_super_admin()
      or (storage.foldername(name))[1] = public.auth_restaurante_id()::text
    )
  );

create policy "logos_auth_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'logos' and (
      public.is_super_admin()
      or (storage.foldername(name))[1] = public.auth_restaurante_id()::text
    )
  );

create policy "logos_auth_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'logos' and (
      public.is_super_admin()
      or (storage.foldername(name))[1] = public.auth_restaurante_id()::text
    )
  );
