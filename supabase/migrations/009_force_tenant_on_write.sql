-- 009 — Tenant autoritativo no servidor nas escritas de admin
--
-- BUG: ao criar um produto logado como admin de um restaurante novo, o app retornava
-- `new row violates row-level security policy`. A RLS está correta (a policy de escrita
-- `produtos_admin_write` exige restaurante_id = auth_restaurante_id()); o erro ocorria quando o
-- CLIENT enviava um restaurante_id que não batia com o tenant da sessão (context preso/errado ou
-- sessão divergente).
--
-- FIX (defesa no banco, "servidor é a fonte da verdade" — mesmo espírito da RPC criar_item_pedido):
-- um trigger BEFORE INSERT OR UPDATE carimba NEW.restaurante_id := auth_restaurante_id() para um
-- usuário autenticado não-super-admin, ignorando o que o client mandou. Assim:
--   * admin autenticado: restaurante_id sempre vira o do próprio tenant → WITH CHECK passa
--     (nunca mais RLS violation por tenant errado) e nunca grava em outro tenant;
--   * não-admin autenticado (cozinha/garçom): o trigger carimba o tenant, mas o WITH CHECK
--     (current_role()='admin') continua barrando — o trigger NÃO concede escrita;
--   * service role (rota super-admin, createAdminClient) e cliente anônimo: auth.uid() é nulo →
--     trigger PULA → criação de restaurante + categorias padrão segue intacta;
--   * super_admin logado: is_super_admin() → PULA (define restaurante_id explicitamente).

create or replace function public.force_tenant_on_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    new.restaurante_id := public.auth_restaurante_id();
  end if;
  return new;
end;
$$;

alter function public.force_tenant_on_write() owner to postgres;

-- Anexar às tabelas operacionais que recebem restaurante_id do client no fluxo admin.
do $$
declare
  t text;
  tables text[] := array[
    'produtos',
    'categorias',
    'mesas',
    'grupos_adicionais',
    'adicionais',
    'produtos_grupos',
    'horarios_funcionamento'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists force_tenant_on_write on public.%I;', t);
    execute format(
      'create trigger force_tenant_on_write before insert or update on public.%I
         for each row execute function public.force_tenant_on_write();', t);
  end loop;
end;
$$;
