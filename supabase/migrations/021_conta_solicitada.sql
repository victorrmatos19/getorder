-- 021_conta_solicitada.sql
-- Bug "pedir a conta não chega pro garçom": o cliente sinaliza, o garçom vê em tempo real
-- (badge "Conta pedida"), e o sinal é limpo ao atender (abrir a comanda) ou ao fechar.
-- Modelado como TIMESTAMP na comanda (v1 simples). Push fica fora de escopo (item separado).

-- 1) coluna do sinal
alter table public.comandas
  add column if not exists conta_solicitada_em timestamptz;

-- 2) CLIENTE (anon) sinaliza "quero a conta" — só na PRÓPRIA comanda 'aberta'.
--    Espelha cancelar_item_cliente (migration 016): SECURITY DEFINER + guard + auditoria.
create or replace function public.solicitar_conta(p_comanda_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
  v_rest uuid;
begin
  update comandas
     set conta_solicitada_em = coalesce(conta_solicitada_em, now())  -- mantém o 1º horário pedido
   where id = p_comanda_id
     and status = 'aberta'
  returning restaurante_id into v_rest;
  get diagnostics v_n = row_count;

  if v_n > 0 then
    insert into auditoria (restaurante_id, user_id, acao, detalhe)
    values (v_rest, auth.uid(), 'solicitar_conta',
            jsonb_build_object('comanda_id', p_comanda_id));
  end if;

  return v_n > 0;
end;
$$;
alter function public.solicitar_conta(uuid) owner to postgres;
revoke all on function public.solicitar_conta(uuid) from public;
grant execute on function public.solicitar_conta(uuid) to anon, authenticated;

-- 3) GARÇOM/ADMIN marca como atendida (limpa o sinal) — tenant-guard; idempotente (no-op se já nulo).
create or replace function public.marcar_conta_atendida(p_comanda_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update comandas
     set conta_solicitada_em = null
   where id = p_comanda_id
     and restaurante_id = public.auth_restaurante_id()
     and status = 'aberta'
     and conta_solicitada_em is not null;
end;
$$;
alter function public.marcar_conta_atendida(uuid) owner to postgres;
revoke all on function public.marcar_conta_atendida(uuid) from public;
grant execute on function public.marcar_conta_atendida(uuid) to authenticated;

-- 4) get_comanda_cliente passa a retornar conta_solicitada_em (botão "Conta solicitada ✓" no cliente).
--    Mesma definição da migration 016 + o campo novo.
create or replace function public.get_comanda_cliente(p_comanda_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', c.id,
    'status', c.status,
    'cliente_nome', c.cliente_nome,
    'conta_solicitada_em', c.conta_solicitada_em,
    'itens', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'quantidade', i.quantidade,
          'obs', i.obs,
          'status', i.status,
          'criado_em', i.criado_em,
          'preco_base_snapshot', i.preco_base_snapshot,
          'produto', jsonb_build_object('id', p.id, 'nome', p.nome, 'preco', p.preco),
          'adicionais', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', a.id,
                'nome_snapshot', a.nome_snapshot,
                'preco_snapshot', a.preco_snapshot
              ) order by a.criado_em
            )
            from itens_pedido_adicionais a
            where a.item_pedido_id = i.id
          ), '[]'::jsonb)
        ) order by i.criado_em
      )
      from itens_pedido i
      join produtos p on p.id = i.produto_id
      where i.comanda_id = c.id
    ), '[]'::jsonb)
  )
  into result
  from comandas c
  where c.id = p_comanda_id;

  return result; -- null se a comanda não existir
end;
$$;
alter function public.get_comanda_cliente(uuid) owner to postgres;
revoke all on function public.get_comanda_cliente(uuid) from public;
grant execute on function public.get_comanda_cliente(uuid) to anon, authenticated;

-- 5) Realtime: garante public.comandas na publicação (no-op se já estiver — evita erro de ownership).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comandas'
  ) then
    alter publication supabase_realtime add table public.comandas;
  end if;
end$$;
