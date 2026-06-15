-- 005 — Abertura de comanda direto na mesa (sem identificação)
-- A rota pública /mesa/[id] deixa de coletar nome/CPF do cliente.
-- A comanda passa a ser aberta anonimamente e compartilhada por mesa.
-- Tornar as colunas de identificação opcionais (defensivo: no-op se já forem nullable).

alter table public.comandas alter column cliente_nome drop not null;
alter table public.comandas alter column cliente_cpf  drop not null;

-- Observações:
-- * Nenhuma policy RLS muda: `comandas_anon_insert` já permite insert apenas com
--   status='aberta' + mesa ativa, e `comandas_select_all` (using true) já permite
--   ao cliente anônimo localizar a comanda aberta da mesa.
-- * aceite_lgpd_em permanece nullable (sem coleta de dado pessoal no fluxo do cliente).
