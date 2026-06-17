-- 011 — Admin pode salvar as CONFIGURAÇÕES do próprio restaurante
--
-- BUG (pré-existente): `restaurantes` só tinha policy de escrita `restaurantes_super_admin_write`
-- (`is_super_admin()`). Nenhuma policy permitia o ADMIN do restaurante atualizar a própria linha,
-- então /admin/configuracoes (taxa de serviço, taxa obrigatória, pausa de pedidos + mensagem)
-- fazia um UPDATE que casava 0 linhas → PATCH 204 "sucesso" mas nada gravava. Afeta todo admin.
--
-- FIX: policy de UPDATE permitindo o admin alterar APENAS o próprio restaurante; e um trigger que
-- preserva os campos de domínio do super-admin (`slug`, `ativo`) em updates de não-super-admin,
-- já que RLS não restringe por coluna.

-- Policy: admin atualiza só o próprio restaurante (super_admin já tem _super_admin_write ALL).
drop policy if exists "restaurantes_admin_update" on public.restaurantes;
create policy "restaurantes_admin_update" on public.restaurantes
  for update to authenticated
  using (public.current_role() = 'admin' and id = public.auth_restaurante_id())
  with check (public.current_role() = 'admin' and id = public.auth_restaurante_id());

-- Trigger: admin não muda slug/ativo (controle do super-admin). Super-admin e service-role passam.
create or replace function public.protect_restaurante_super_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    new.slug  := old.slug;
    new.ativo := old.ativo;
  end if;
  return new;
end;
$$;

alter function public.protect_restaurante_super_fields() owner to postgres;

drop trigger if exists protect_restaurante_super_fields on public.restaurantes;
create trigger protect_restaurante_super_fields
  before update on public.restaurantes
  for each row execute function public.protect_restaurante_super_fields();
