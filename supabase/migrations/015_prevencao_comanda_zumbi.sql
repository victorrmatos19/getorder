-- 015_prevencao_comanda_zumbi.sql
-- Prevenção de comanda-zumbi — Caso 1 (comanda VAZIA).
-- Expira automaticamente comandas 'aberta' SEM itens paradas > 30 min (pg_cron)
-- e permite o garçom/admin cancelar manualmente uma comanda vazia.
-- Comandas COM itens nunca são tocadas (fecham via "Encerrar e cobrar").

-- 1) Colunas de auditoria em comandas (mantém RLS/tenant por restaurante_id)
alter table public.comandas add column if not exists cancelada_em timestamptz;
alter table public.comandas add column if not exists cancelada_por uuid references auth.users(id); -- null = sistema (job)
alter table public.comandas add column if not exists cancelamento_motivo text; -- 'expiracao_automatica' | 'cancelada_garcom'

-- 2) Job agendado (pg_cron): expira comandas vazias paradas > 30 min
--    "Última atividade" do Caso 1 = o próprio comandas.criado_em (comanda vazia não tem itens).
create extension if not exists pg_cron;

create or replace function public.expirar_comandas_vazias()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update comandas c
     set status = 'cancelada',
         cancelada_em = now(),
         cancelamento_motivo = 'expiracao_automatica'
   where c.status = 'aberta'
     and c.criado_em < now() - interval '30 minutes'
     -- guard de race: se um item entrar entre a checagem e o update, o not exists falha
     and not exists (select 1 from itens_pedido i where i.comanda_id = c.id);
end;
$$;

-- idempotente: cron.schedule faz upsert pelo nome do job
select cron.schedule('expirar-comandas-vazias', '*/5 * * * *',
  $$select public.expirar_comandas_vazias();$$);

-- 3) Cancelamento manual (garçom/admin) — SÓ em comanda vazia
create or replace function public.cancelar_comanda_vazia(p_comanda_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update comandas
     set status = 'cancelada',
         cancelada_em = now(),
         cancelada_por = auth.uid(),
         cancelamento_motivo = 'cancelada_garcom'
   where id = p_comanda_id
     and restaurante_id = public.auth_restaurante_id()
     and status = 'aberta'
     and not exists (select 1 from itens_pedido i where i.comanda_id = p_comanda_id);
  if not found then
    raise exception 'Comanda não pode ser cancelada (inexistente, já fechada ou possui itens).';
  end if;
end;
$$;

revoke all on function public.cancelar_comanda_vazia(uuid) from public;
grant execute on function public.cancelar_comanda_vazia(uuid) to authenticated;
