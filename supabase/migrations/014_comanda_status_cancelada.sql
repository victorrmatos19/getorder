-- 014_comanda_status_cancelada.sql
-- Novo status 'cancelada' no enum comanda_status (prevenção de comanda-zumbi).
-- ⚠️ Precisa ser uma migration SEPARADA: o valor novo do enum só pode ser usado
-- depois de commitado. As funções/queries que referenciam 'cancelada' ficam na 015.
alter type public.comanda_status add value if not exists 'cancelada';
