-- 019 — Gestão de usuários do restaurante (admin cria equipe)
-- Adiciona nome (exibição) e ativo (soft-delete) à tabela perfis.
--
-- Contexto: o admin passa a criar/gerenciar garçom e cozinha do próprio
-- restaurante (tela /admin/usuarios + endpoints server-side com service_role).
-- "Remover" = desativar (ativo=false), nunca apagar — apagar quebraria o
-- histórico (itens_pedido.cancelado_por / comandas.cancelada_por -> auth.users).
--
-- RLS: nenhuma policy nova. A `perfis_select` do baseline já permite o admin
-- ler perfis do próprio tenant (current_role()='admin' AND restaurante_id =
-- auth_restaurante_id()); a escrita continua restrita a super_admin
-- (perfis_super_admin_write) — o client NUNCA escreve perfis direto. Toda a
-- escrita desta feature passa pelos Route Handlers privilegiados (service_role).

alter table public.perfis
  add column if not exists nome  text,
  add column if not exists ativo boolean not null default true;

comment on column public.perfis.nome  is 'Nome de exibição do usuário (staff). Nullable; UI faz fallback para o e-mail.';
comment on column public.perfis.ativo is 'false = desativado: bloqueia login (banido no Auth) e barrado no middleware. Preserva histórico.';
