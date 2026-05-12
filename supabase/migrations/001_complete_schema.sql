-- Adiciona colunas que o app espera mas que não existem no schema atual.
-- Seguro de rodar várias vezes (usa IF NOT EXISTS).

-- comandas
alter table public.comandas
  add column if not exists total numeric(10,2),
  add column if not exists forma_pagamento text check (forma_pagamento in ('pix','debito','credito','dinheiro')),
  add column if not exists fechado_em timestamptz;

-- produtos
alter table public.produtos
  add column if not exists foto_url text,
  add column if not exists criado_em timestamptz not null default now();

-- mesas
alter table public.mesas
  add column if not exists criado_em timestamptz not null default now();

-- Índices úteis para o dashboard e listas
create index if not exists comandas_status_idx       on public.comandas (status);
create index if not exists comandas_fechado_em_idx   on public.comandas (fechado_em);
create index if not exists itens_pedido_status_idx   on public.itens_pedido (status);
create index if not exists itens_pedido_comanda_idx  on public.itens_pedido (comanda_id);
create index if not exists itens_pedido_criado_idx   on public.itens_pedido (criado_em);
