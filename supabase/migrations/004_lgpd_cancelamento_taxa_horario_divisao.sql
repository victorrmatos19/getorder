-- ============================================================
-- 637 SaaS — pré-comercialização
-- LGPD + cancelamento + obs + taxa configurável + horário + pausa + divisão
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- restaurantes — configurações
-- ------------------------------------------------------------
alter table public.restaurantes
  add column if not exists taxa_servico_percentual  numeric(5,2) not null default 10.00,
  add column if not exists taxa_servico_obrigatoria boolean      not null default false,
  add column if not exists pedidos_pausados         boolean      not null default false,
  add column if not exists pausa_mensagem           text;

-- ------------------------------------------------------------
-- horários de funcionamento
-- ------------------------------------------------------------
create table if not exists public.horarios_funcionamento (
  id              uuid primary key default gen_random_uuid(),
  restaurante_id  uuid not null references public.restaurantes(id) on delete cascade,
  dia_semana      integer not null check (dia_semana between 0 and 6),
  abre            time,
  fecha           time,
  fechado         boolean not null default false,
  unique (restaurante_id, dia_semana)
);

create index if not exists idx_horarios_restaurante on public.horarios_funcionamento(restaurante_id);

alter table public.horarios_funcionamento enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'horarios_funcionamento'
  loop
    execute format('drop policy if exists %I on public.horarios_funcionamento', p.policyname);
  end loop;
end $$;

create policy horarios_select_public on public.horarios_funcionamento
  for select using (true);

create policy horarios_admin_write on public.horarios_funcionamento
  for all to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() = 'admin' and restaurante_id = public.auth_restaurante_id())
  )
  with check (
    public.is_super_admin()
    or (public.current_role() = 'admin' and restaurante_id = public.auth_restaurante_id())
  );

-- ------------------------------------------------------------
-- LGPD + divisão de conta + valores de taxa por comanda
-- ------------------------------------------------------------
alter table public.comandas
  add column if not exists aceite_lgpd_em        timestamptz,
  add column if not exists numero_pessoas        integer not null default 1,
  add column if not exists taxa_servico_valor    numeric(10,2),
  add column if not exists taxa_servico_aplicada boolean not null default true;

-- ------------------------------------------------------------
-- itens_pedido — cancelamento + status 'cancelado'
-- (mantém coluna `obs` já existente conforme schema inicial)
-- ------------------------------------------------------------
alter table public.itens_pedido
  add column if not exists cancelado_em    timestamptz,
  add column if not exists cancelado_por   uuid references auth.users(id);

-- Suportar status 'cancelado' tanto se a coluna for ENUM quanto TEXT
do $$
declare
  col_type text;
  cname    text;
  enum_typ text;
begin
  select c.data_type, c.udt_name
    into col_type, enum_typ
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name   = 'itens_pedido'
     and c.column_name  = 'status';

  if col_type = 'USER-DEFINED' then
    -- coluna usa enum (provavelmente item_status). Adicionar valor se faltar.
    if not exists (
      select 1
        from pg_enum e
        join pg_type t on t.oid = e.enumtypid
       where t.typname  = enum_typ
         and e.enumlabel = 'cancelado'
    ) then
      execute format('alter type public.%I add value %L', enum_typ, 'cancelado');
    end if;
  else
    -- coluna text/varchar: drop check antigo e recria incluindo 'cancelado'
    select conname into cname
      from pg_constraint
     where conrelid = 'public.itens_pedido'::regclass
       and contype  = 'c'
       and pg_get_constraintdef(oid) ilike '%status%';
    if cname is not null then
      execute format('alter table public.itens_pedido drop constraint %I', cname);
    end if;
    execute 'alter table public.itens_pedido
              add constraint itens_pedido_status_check
              check (status in (''novo'',''em_preparo'',''pronto'',''entregue'',''cancelado''))';
  end if;
end $$;

-- ------------------------------------------------------------
-- Seed: horários padrão para o 637 (idempotente)
-- ------------------------------------------------------------
insert into public.horarios_funcionamento (restaurante_id, dia_semana, abre, fecha, fechado)
select
  r.id,
  d.dia,
  case when d.dia in (0,6) then '11:00'::time else '17:00'::time end as abre,
  '23:00'::time as fecha,
  false
from public.restaurantes r
cross join (select generate_series(0,6) as dia) d
where r.slug = '637-cerveja'
on conflict (restaurante_id, dia_semana) do nothing;

-- ============================================================
-- Função de validação: pode receber pedido agora?
-- ============================================================
create or replace function public.can_place_order(p_restaurante_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rest    public.restaurantes;
  v_horario public.horarios_funcionamento;
  v_dia     integer;
  v_now     time;
begin
  select * into v_rest from public.restaurantes where id = p_restaurante_id;
  if v_rest is null or not v_rest.ativo then
    return false;
  end if;

  if v_rest.pedidos_pausados then
    return false;
  end if;

  v_dia := extract(dow from (now() at time zone 'America/Sao_Paulo'))::int;
  v_now := ((now() at time zone 'America/Sao_Paulo')::time);

  select * into v_horario
    from public.horarios_funcionamento
   where restaurante_id = p_restaurante_id
     and dia_semana = v_dia;

  if v_horario is null or v_horario.fechado then
    return false;
  end if;

  if v_horario.abre is null or v_horario.fecha is null then
    return false;
  end if;

  if v_now < v_horario.abre or v_now > v_horario.fecha then
    return false;
  end if;

  return true;
end;
$$;

grant execute on function public.can_place_order(uuid) to anon, authenticated;

-- Trigger BEFORE INSERT em itens_pedido — bloqueia inserção de status 'novo'
-- feita por sessão anônima (cliente) quando o estabelecimento não pode
-- receber pedido. Staff autenticado continua podendo lançar manualmente.
create or replace function public.itens_pedido_horario_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'novo' and auth.uid() is null then
    if not public.can_place_order(new.restaurante_id) then
      raise exception 'Pedidos indisponíveis no momento (pausa ou fora de horário).'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists itens_pedido_horario_guard on public.itens_pedido;
create trigger itens_pedido_horario_guard
  before insert on public.itens_pedido
  for each row execute function public.itens_pedido_horario_guard();
