-- 007 — Correções da RPC criar_item_pedido (Fase 1)
--
-- 1) BUG (bloqueante): a função inseria na coluna `observacao`, mas a coluna
--    real de itens_pedido é `obs`. Resultado: "column 'observacao' of relation
--    'itens_pedido' does not exist" ao adicionar item via RPC.
--    Correção: o INSERT passa a usar a coluna `obs`. O parâmetro continua
--    `p_observacao` (nenhuma mudança no app/wrapper).
--
-- 2) HARDENING (anti-tampering): a validação só checava `adicionais.disponivel`,
--    não `grupos_adicionais.ativo`. Um adicional de um grupo INATIVO (mas ainda
--    vinculado) passava sem ter as regras do grupo validadas. Agora exige
--    `g.ativo = true` — alinhado à UI do cliente, que só mostra grupos ativos.
--
-- `create or replace` substitui a função existente sem precisar dropar.

create or replace function criar_item_pedido(
  p_comanda_id uuid,
  p_produto_id uuid,
  p_quantidade int,
  p_observacao text,
  p_adicional_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurante_id uuid;
  v_comanda_status text;
  v_preco_base numeric(10,2);
  v_produto_disp boolean;
  v_item_id uuid;
  r_grupo record;
  v_count int;
begin
  select restaurante_id, status into v_restaurante_id, v_comanda_status
  from comandas where id = p_comanda_id;
  if v_restaurante_id is null then raise exception 'Comanda não encontrada'; end if;
  if v_comanda_status <> 'aberta' then raise exception 'Comanda não está aberta'; end if;

  select preco, disponivel into v_preco_base, v_produto_disp
  from produtos where id = p_produto_id and restaurante_id = v_restaurante_id;
  if v_preco_base is null then raise exception 'Produto inválido'; end if;
  if not v_produto_disp then raise exception 'Produto indisponível'; end if;
  if p_quantidade is null or p_quantidade < 1 then raise exception 'Quantidade inválida'; end if;

  -- Anti-tampering: todo adicional escolhido tem que pertencer a um grupo
  -- ATIVO vinculado a ESTE produto, do mesmo restaurante, e estar disponível.
  if p_adicional_ids is not null and array_length(p_adicional_ids,1) > 0 then
    if exists (
      select 1 from unnest(p_adicional_ids) aid
      where not exists (
        select 1 from adicionais a
        join grupos_adicionais g on g.id = a.grupo_id
        join produtos_grupos pg on pg.grupo_id = a.grupo_id
        where a.id = aid
          and a.restaurante_id = v_restaurante_id
          and a.disponivel = true
          and g.ativo = true
          and pg.produto_id = p_produto_id
      )
    ) then raise exception 'Adicional inválido para este produto'; end if;
  end if;

  -- Validação das regras de cada grupo vinculado ao produto
  for r_grupo in
    select g.id, g.nome, g.selecao, g.obrigatorio, g.min_escolhas, g.max_escolhas
    from produtos_grupos pg
    join grupos_adicionais g on g.id = pg.grupo_id
    where pg.produto_id = p_produto_id and g.ativo and g.restaurante_id = v_restaurante_id
  loop
    select count(*) into v_count
    from adicionais a
    where a.grupo_id = r_grupo.id and a.id = any(coalesce(p_adicional_ids,'{}'));

    if r_grupo.obrigatorio and v_count < greatest(r_grupo.min_escolhas,1) then
      raise exception 'Grupo obrigatório sem seleção: %', r_grupo.nome; end if;
    if v_count < r_grupo.min_escolhas then
      raise exception 'Mínimo de escolhas não atingido em: %', r_grupo.nome; end if;
    if r_grupo.selecao = 'unica' and v_count > 1 then
      raise exception 'Apenas uma escolha permitida em: %', r_grupo.nome; end if;
    if r_grupo.max_escolhas is not null and v_count > r_grupo.max_escolhas then
      raise exception 'Máximo de escolhas excedido em: %', r_grupo.nome; end if;
  end loop;

  -- Insere item com snapshot do preço base (coluna correta: obs)
  insert into itens_pedido
    (restaurante_id, comanda_id, produto_id, quantidade, obs, status, preco_base_snapshot)
  values
    (v_restaurante_id, p_comanda_id, p_produto_id, p_quantidade,
     nullif(p_observacao,''), 'novo', v_preco_base)
  returning id into v_item_id;

  -- Snapshot dos adicionais (lê preço REAL do banco, ignora qualquer preço do client)
  insert into itens_pedido_adicionais
    (restaurante_id, item_pedido_id, adicional_id, grupo_nome_snapshot, nome_snapshot, preco_snapshot)
  select v_restaurante_id, v_item_id, a.id, g.nome, a.nome, a.preco
  from adicionais a
  join grupos_adicionais g on g.id = a.grupo_id
  where a.id = any(coalesce(p_adicional_ids,'{}'));

  return v_item_id;
end;
$$;

grant execute on function criar_item_pedido(uuid, uuid, int, text, uuid[])
  to anon, authenticated;
