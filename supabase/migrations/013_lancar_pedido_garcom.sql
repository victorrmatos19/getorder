-- 013_lancar_pedido_garcom.sql
-- Lançamento manual de pedido pelo garçom (tela de staff).
-- Uma RPC transacional SECURITY DEFINER que: resolve o restaurante via
-- auth_restaurante_id(), faz find-or-create da comanda 'aberta' da mesa
-- (modelo mesa fixa) e reaproveita criar_item_pedido para CADA item
-- (preço/validação/snapshot 100% no servidor). O frontend só manda IDs.
--
-- p_itens: jsonb array de { produto_id, quantidade, observacao, adicionais: [uuid...] }
-- Retorna o id da comanda (nova ou existente).

create or replace function public.lancar_pedido_garcom(
  p_comanda_id uuid,
  p_mesa_id uuid,
  p_itens jsonb
) returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_rest uuid;
  v_role text;
  v_comanda uuid;
  v_status text;
  v_com_rest uuid;
  v_mesa_rest uuid;
  v_mesa_ativo boolean;
  r_item jsonb;
  v_adicionais uuid[];
begin
  v_rest := public.auth_restaurante_id();
  if v_rest is null then raise exception 'Não autenticado'; end if;

  if not public.is_super_admin() then
    v_role := public.current_role();
    if v_role is null or v_role not in ('admin','garcom') then
      raise exception 'Acesso negado';
    end if;
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Nenhum item para lançar';
  end if;

  -- 1) Resolver a comanda (existente OU find-or-create da mesa)
  if p_comanda_id is not null then
    select restaurante_id, status into v_com_rest, v_status
    from comandas where id = p_comanda_id;
    if v_com_rest is null then raise exception 'Comanda não encontrada'; end if;
    if v_com_rest <> v_rest then raise exception 'Comanda de outro restaurante'; end if;
    if v_status <> 'aberta' then raise exception 'Comanda não está aberta'; end if;
    v_comanda := p_comanda_id;
  else
    if p_mesa_id is null then raise exception 'Informe a mesa'; end if;
    select restaurante_id, ativo into v_mesa_rest, v_mesa_ativo
    from mesas where id = p_mesa_id;
    if v_mesa_rest is null then raise exception 'Mesa não encontrada'; end if;
    if v_mesa_rest <> v_rest then raise exception 'Mesa de outro restaurante'; end if;
    if not v_mesa_ativo then raise exception 'Mesa inativa'; end if;

    select id into v_comanda
    from comandas
    where mesa_id = p_mesa_id and status = 'aberta'
    order by criado_em desc
    limit 1;

    if v_comanda is null then
      insert into comandas (mesa_id, restaurante_id, status)
      values (p_mesa_id, v_rest, 'aberta')
      returning id into v_comanda;
    end if;
  end if;

  -- 2) Lançar cada item via criar_item_pedido (1 transação; erro = rollback total)
  for r_item in select value from jsonb_array_elements(p_itens)
  loop
    v_adicionais := coalesce(
      (select array_agg(elem::uuid)
         from jsonb_array_elements_text(coalesce(r_item->'adicionais', '[]'::jsonb)) as elem),
      '{}'::uuid[]
    );
    perform criar_item_pedido(
      v_comanda,
      (r_item->>'produto_id')::uuid,
      coalesce((r_item->>'quantidade')::int, 1),
      coalesce(r_item->>'observacao', ''),
      v_adicionais
    );
  end loop;

  return v_comanda;
end;
$$;

alter function public.lancar_pedido_garcom(uuid, uuid, jsonb) owner to postgres;
revoke all on function public.lancar_pedido_garcom(uuid, uuid, jsonb) from public;
grant execute on function public.lancar_pedido_garcom(uuid, uuid, jsonb) to authenticated;
