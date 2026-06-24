-- 018 — White-label: cor separada para preços
-- Follow-up da personalização (017). Desacopla a cor do PREÇO da cor do botão (accent).
-- cor_preco nullable; NULL = usa o accent (comportamento atual, retrocompatível).
-- Validação hex no servidor. Escrita já coberta pela policy restaurantes_admin_update (011).

alter table public.restaurantes
  add column if not exists cor_preco text;

alter table public.restaurantes drop constraint if exists restaurantes_cor_preco_hex;
alter table public.restaurantes
  add constraint restaurantes_cor_preco_hex
  check (cor_preco is null or cor_preco ~* '^#[0-9a-f]{6}$');
