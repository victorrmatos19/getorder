


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."categoria" AS ENUM (
    'cervejas',
    'lanches',
    'drinks',
    'petiscos'
);


ALTER TYPE "public"."categoria" OWNER TO "postgres";


CREATE TYPE "public"."comanda_status" AS ENUM (
    'aberta',
    'fechada'
);


ALTER TYPE "public"."comanda_status" OWNER TO "postgres";


CREATE TYPE "public"."espaco_tipo" AS ENUM (
    'mesa',
    'quadra'
);


ALTER TYPE "public"."espaco_tipo" OWNER TO "postgres";


CREATE TYPE "public"."item_status" AS ENUM (
    'novo',
    'em_preparo',
    'pronto',
    'entregue',
    'cancelado'
);


ALTER TYPE "public"."item_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_restaurante_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select restaurante_id from public.perfis where id = auth.uid()
$$;


ALTER FUNCTION "public"."auth_restaurante_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_place_order"("p_restaurante_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."can_place_order"("p_restaurante_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_item_pedido"("p_comanda_id" "uuid", "p_produto_id" "uuid", "p_quantidade" integer, "p_observacao" "text", "p_adicional_ids" "uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."criar_item_pedido"("p_comanda_id" "uuid", "p_produto_id" "uuid", "p_quantidade" integer, "p_observacao" "text", "p_adicional_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role from public.perfis where id = auth.uid()
$$;


ALTER FUNCTION "public"."current_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.perfis
     where id = auth.uid() and role = 'super_admin'
  )
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."itens_pedido_horario_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."itens_pedido_horario_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."adicionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurante_id" "uuid" NOT NULL,
    "grupo_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "preco" numeric(10,2) DEFAULT 0 NOT NULL,
    "disponivel" boolean DEFAULT true NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."adicionais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurante_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "emoji" "text",
    "ordem" integer DEFAULT 0 NOT NULL,
    "ativa" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categorias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comandas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mesa_id" "uuid" NOT NULL,
    "cliente_nome" "text",
    "cliente_cpf" "text",
    "status" "public"."comanda_status" DEFAULT 'aberta'::"public"."comanda_status" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total" numeric(10,2),
    "forma_pagamento" "text",
    "fechado_em" timestamp with time zone,
    "restaurante_id" "uuid" NOT NULL,
    "aceite_lgpd_em" timestamp with time zone,
    "numero_pessoas" integer DEFAULT 1 NOT NULL,
    "taxa_servico_valor" numeric(10,2),
    "taxa_servico_aplicada" boolean DEFAULT true NOT NULL,
    CONSTRAINT "comandas_forma_pagamento_check" CHECK (("forma_pagamento" = ANY (ARRAY['pix'::"text", 'debito'::"text", 'credito'::"text", 'dinheiro'::"text"])))
);


ALTER TABLE "public"."comandas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grupos_adicionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurante_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "selecao" "text" NOT NULL,
    "obrigatorio" boolean DEFAULT false NOT NULL,
    "min_escolhas" integer DEFAULT 0 NOT NULL,
    "max_escolhas" integer,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "grupos_adicionais_selecao_check" CHECK (("selecao" = ANY (ARRAY['unica'::"text", 'multipla'::"text"])))
);


ALTER TABLE "public"."grupos_adicionais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."horarios_funcionamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurante_id" "uuid" NOT NULL,
    "dia_semana" integer NOT NULL,
    "abre" time without time zone,
    "fecha" time without time zone,
    "fechado" boolean DEFAULT false NOT NULL,
    CONSTRAINT "horarios_funcionamento_dia_semana_check" CHECK ((("dia_semana" >= 0) AND ("dia_semana" <= 6)))
);


ALTER TABLE "public"."horarios_funcionamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itens_pedido" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comanda_id" "uuid" NOT NULL,
    "produto_id" "uuid" NOT NULL,
    "quantidade" integer NOT NULL,
    "obs" "text",
    "status" "public"."item_status" DEFAULT 'novo'::"public"."item_status" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "restaurante_id" "uuid" NOT NULL,
    "cancelado_em" timestamp with time zone,
    "cancelado_por" "uuid",
    "preco_base_snapshot" numeric(10,2),
    CONSTRAINT "itens_pedido_quantidade_check" CHECK (("quantidade" > 0))
);


ALTER TABLE "public"."itens_pedido" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itens_pedido_adicionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurante_id" "uuid" NOT NULL,
    "item_pedido_id" "uuid" NOT NULL,
    "adicional_id" "uuid",
    "grupo_nome_snapshot" "text",
    "nome_snapshot" "text" NOT NULL,
    "preco_snapshot" numeric(10,2) DEFAULT 0 NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."itens_pedido_adicionais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mesas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "tipo" "public"."espaco_tipo" DEFAULT 'mesa'::"public"."espaco_tipo" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "restaurante_id" "uuid" NOT NULL
);


ALTER TABLE "public"."mesas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."perfis" (
    "id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "restaurante_id" "uuid",
    CONSTRAINT "perfis_role_check" CHECK (("role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'garcom'::"text", 'cozinha'::"text"])))
);


ALTER TABLE "public"."perfis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produtos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text" DEFAULT ''::"text" NOT NULL,
    "preco" numeric(10,2) DEFAULT 0 NOT NULL,
    "categoria" "text",
    "disponivel" boolean DEFAULT true NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "foto_url" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "restaurante_id" "uuid" NOT NULL,
    "categoria_id" "uuid",
    "em_oferta" boolean DEFAULT false NOT NULL,
    "novidade" boolean DEFAULT false NOT NULL,
    "oferta_preco" numeric(10,2),
    "destaque_ordem" integer DEFAULT 999 NOT NULL
);


ALTER TABLE "public"."produtos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produtos_grupos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurante_id" "uuid" NOT NULL,
    "produto_id" "uuid" NOT NULL,
    "grupo_id" "uuid" NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."produtos_grupos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurantes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "logo_url" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "taxa_servico_percentual" numeric(5,2) DEFAULT 10.00 NOT NULL,
    "taxa_servico_obrigatoria" boolean DEFAULT false NOT NULL,
    "pedidos_pausados" boolean DEFAULT false NOT NULL,
    "pausa_mensagem" "text"
);


ALTER TABLE "public"."restaurantes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."adicionais"
    ADD CONSTRAINT "adicionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_restaurante_id_nome_key" UNIQUE ("restaurante_id", "nome");



ALTER TABLE ONLY "public"."comandas"
    ADD CONSTRAINT "comandas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grupos_adicionais"
    ADD CONSTRAINT "grupos_adicionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."horarios_funcionamento"
    ADD CONSTRAINT "horarios_funcionamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."horarios_funcionamento"
    ADD CONSTRAINT "horarios_funcionamento_restaurante_id_dia_semana_key" UNIQUE ("restaurante_id", "dia_semana");



ALTER TABLE ONLY "public"."itens_pedido_adicionais"
    ADD CONSTRAINT "itens_pedido_adicionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mesas"
    ADD CONSTRAINT "mesas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfis"
    ADD CONSTRAINT "perfis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produtos_grupos"
    ADD CONSTRAINT "produtos_grupos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produtos_grupos"
    ADD CONSTRAINT "produtos_grupos_produto_id_grupo_id_key" UNIQUE ("produto_id", "grupo_id");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurantes"
    ADD CONSTRAINT "restaurantes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurantes"
    ADD CONSTRAINT "restaurantes_slug_key" UNIQUE ("slug");



CREATE INDEX "comandas_fechado_em_idx" ON "public"."comandas" USING "btree" ("fechado_em");



CREATE INDEX "comandas_status_idx" ON "public"."comandas" USING "btree" ("status");



CREATE INDEX "idx_adicionais_grupo" ON "public"."adicionais" USING "btree" ("grupo_id");



CREATE INDEX "idx_adicionais_restaurante" ON "public"."adicionais" USING "btree" ("restaurante_id");



CREATE INDEX "idx_categorias_restaurante" ON "public"."categorias" USING "btree" ("restaurante_id");



CREATE INDEX "idx_comandas_mesa_status" ON "public"."comandas" USING "btree" ("mesa_id", "status");



CREATE INDEX "idx_comandas_restaurante" ON "public"."comandas" USING "btree" ("restaurante_id");



CREATE INDEX "idx_grupos_adicionais_restaurante" ON "public"."grupos_adicionais" USING "btree" ("restaurante_id");



CREATE INDEX "idx_horarios_restaurante" ON "public"."horarios_funcionamento" USING "btree" ("restaurante_id");



CREATE INDEX "idx_ipa_item" ON "public"."itens_pedido_adicionais" USING "btree" ("item_pedido_id");



CREATE INDEX "idx_ipa_restaurante" ON "public"."itens_pedido_adicionais" USING "btree" ("restaurante_id");



CREATE INDEX "idx_itens_comanda" ON "public"."itens_pedido" USING "btree" ("comanda_id");



CREATE INDEX "idx_itens_restaurante" ON "public"."itens_pedido" USING "btree" ("restaurante_id");



CREATE INDEX "idx_itens_status" ON "public"."itens_pedido" USING "btree" ("status");



CREATE INDEX "idx_mesas_restaurante" ON "public"."mesas" USING "btree" ("restaurante_id");



CREATE INDEX "idx_perfis_restaurante" ON "public"."perfis" USING "btree" ("restaurante_id");



CREATE INDEX "idx_produtos_categoria" ON "public"."produtos" USING "btree" ("categoria_id");



CREATE INDEX "idx_produtos_grupos_grupo" ON "public"."produtos_grupos" USING "btree" ("grupo_id");



CREATE INDEX "idx_produtos_grupos_produto" ON "public"."produtos_grupos" USING "btree" ("produto_id");



CREATE INDEX "idx_produtos_grupos_restaurante" ON "public"."produtos_grupos" USING "btree" ("restaurante_id");



CREATE INDEX "idx_produtos_restaurante" ON "public"."produtos" USING "btree" ("restaurante_id");



CREATE INDEX "itens_pedido_comanda_idx" ON "public"."itens_pedido" USING "btree" ("comanda_id");



CREATE INDEX "itens_pedido_status_idx" ON "public"."itens_pedido" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "itens_pedido_horario_guard" BEFORE INSERT ON "public"."itens_pedido" FOR EACH ROW EXECUTE FUNCTION "public"."itens_pedido_horario_guard"();



ALTER TABLE ONLY "public"."adicionais"
    ADD CONSTRAINT "adicionais_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos_adicionais"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."adicionais"
    ADD CONSTRAINT "adicionais_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurantes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurantes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comandas"
    ADD CONSTRAINT "comandas_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "public"."mesas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."comandas"
    ADD CONSTRAINT "comandas_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurantes"("id");



ALTER TABLE ONLY "public"."grupos_adicionais"
    ADD CONSTRAINT "grupos_adicionais_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurantes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."horarios_funcionamento"
    ADD CONSTRAINT "horarios_funcionamento_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurantes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itens_pedido_adicionais"
    ADD CONSTRAINT "itens_pedido_adicionais_adicional_id_fkey" FOREIGN KEY ("adicional_id") REFERENCES "public"."adicionais"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."itens_pedido_adicionais"
    ADD CONSTRAINT "itens_pedido_adicionais_item_pedido_id_fkey" FOREIGN KEY ("item_pedido_id") REFERENCES "public"."itens_pedido"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itens_pedido_adicionais"
    ADD CONSTRAINT "itens_pedido_adicionais_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurantes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_cancelado_por_fkey" FOREIGN KEY ("cancelado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "public"."comandas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."itens_pedido"
    ADD CONSTRAINT "itens_pedido_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurantes"("id");



ALTER TABLE ONLY "public"."mesas"
    ADD CONSTRAINT "mesas_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurantes"("id");



ALTER TABLE ONLY "public"."perfis"
    ADD CONSTRAINT "perfis_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfis"
    ADD CONSTRAINT "perfis_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurantes"("id");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id");



ALTER TABLE ONLY "public"."produtos_grupos"
    ADD CONSTRAINT "produtos_grupos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos_adicionais"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."produtos_grupos"
    ADD CONSTRAINT "produtos_grupos_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."produtos_grupos"
    ADD CONSTRAINT "produtos_grupos_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurantes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurantes"("id");



ALTER TABLE "public"."adicionais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categorias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categorias_admin_write" ON "public"."categorias" TO "authenticated" USING (("public"."is_super_admin"() OR (("public"."current_role"() = 'admin'::"text") AND ("restaurante_id" = "public"."auth_restaurante_id"())))) WITH CHECK (("public"."is_super_admin"() OR (("public"."current_role"() = 'admin'::"text") AND ("restaurante_id" = "public"."auth_restaurante_id"()))));



CREATE POLICY "categorias_select_public" ON "public"."categorias" FOR SELECT USING (true);



ALTER TABLE "public"."comandas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comandas_admin_delete" ON "public"."comandas" FOR DELETE TO "authenticated" USING (("public"."is_super_admin"() OR (("public"."current_role"() = 'admin'::"text") AND ("restaurante_id" = "public"."auth_restaurante_id"()))));



CREATE POLICY "comandas_anon_insert" ON "public"."comandas" FOR INSERT TO "anon" WITH CHECK ((("status" = 'aberta'::"public"."comanda_status") AND (EXISTS ( SELECT 1
   FROM "public"."mesas" "m"
  WHERE (("m"."id" = "comandas"."mesa_id") AND ("m"."ativo" = true) AND ("m"."restaurante_id" = "comandas"."restaurante_id"))))));



CREATE POLICY "comandas_select_all" ON "public"."comandas" FOR SELECT USING (true);



CREATE POLICY "comandas_staff_insert" ON "public"."comandas" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_super_admin"() OR (("public"."current_role"() = ANY (ARRAY['admin'::"text", 'garcom'::"text"])) AND ("restaurante_id" = "public"."auth_restaurante_id"()))));



CREATE POLICY "comandas_staff_update" ON "public"."comandas" FOR UPDATE TO "authenticated" USING (("public"."is_super_admin"() OR (("public"."current_role"() = ANY (ARRAY['admin'::"text", 'garcom'::"text"])) AND ("restaurante_id" = "public"."auth_restaurante_id"())))) WITH CHECK (("public"."is_super_admin"() OR (("public"."current_role"() = ANY (ARRAY['admin'::"text", 'garcom'::"text"])) AND ("restaurante_id" = "public"."auth_restaurante_id"()))));



ALTER TABLE "public"."grupos_adicionais" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "horarios_admin_write" ON "public"."horarios_funcionamento" TO "authenticated" USING (("public"."is_super_admin"() OR (("public"."current_role"() = 'admin'::"text") AND ("restaurante_id" = "public"."auth_restaurante_id"())))) WITH CHECK (("public"."is_super_admin"() OR (("public"."current_role"() = 'admin'::"text") AND ("restaurante_id" = "public"."auth_restaurante_id"()))));



ALTER TABLE "public"."horarios_funcionamento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "horarios_select_public" ON "public"."horarios_funcionamento" FOR SELECT USING (true);



CREATE POLICY "itens_admin_delete" ON "public"."itens_pedido" FOR DELETE TO "authenticated" USING (("public"."is_super_admin"() OR (("public"."current_role"() = 'admin'::"text") AND ("restaurante_id" = "public"."auth_restaurante_id"()))));



CREATE POLICY "itens_anon_insert" ON "public"."itens_pedido" FOR INSERT TO "anon" WITH CHECK ((("status" = 'novo'::"public"."item_status") AND (EXISTS ( SELECT 1
   FROM "public"."comandas" "c"
  WHERE (("c"."id" = "itens_pedido"."comanda_id") AND ("c"."status" = 'aberta'::"public"."comanda_status") AND ("c"."restaurante_id" = "itens_pedido"."restaurante_id"))))));



ALTER TABLE "public"."itens_pedido" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."itens_pedido_adicionais" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "itens_select_all" ON "public"."itens_pedido" FOR SELECT USING (true);



CREATE POLICY "itens_staff_insert" ON "public"."itens_pedido" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_super_admin"() OR (("public"."current_role"() = ANY (ARRAY['admin'::"text", 'garcom'::"text", 'cozinha'::"text"])) AND ("restaurante_id" = "public"."auth_restaurante_id"()))));



CREATE POLICY "itens_staff_update" ON "public"."itens_pedido" FOR UPDATE TO "authenticated" USING (("public"."is_super_admin"() OR (("public"."current_role"() = ANY (ARRAY['admin'::"text", 'garcom'::"text", 'cozinha'::"text"])) AND ("restaurante_id" = "public"."auth_restaurante_id"())))) WITH CHECK (("public"."is_super_admin"() OR (("public"."current_role"() = ANY (ARRAY['admin'::"text", 'garcom'::"text", 'cozinha'::"text"])) AND ("restaurante_id" = "public"."auth_restaurante_id"()))));



ALTER TABLE "public"."mesas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mesas_admin_write" ON "public"."mesas" TO "authenticated" USING (("public"."is_super_admin"() OR (("public"."current_role"() = 'admin'::"text") AND ("restaurante_id" = "public"."auth_restaurante_id"())))) WITH CHECK (("public"."is_super_admin"() OR (("public"."current_role"() = 'admin'::"text") AND ("restaurante_id" = "public"."auth_restaurante_id"()))));



CREATE POLICY "mesas_select_public" ON "public"."mesas" FOR SELECT USING (true);



ALTER TABLE "public"."perfis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perfis_select" ON "public"."perfis" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_super_admin"() OR (("public"."current_role"() = 'admin'::"text") AND ("restaurante_id" = "public"."auth_restaurante_id"()))));



CREATE POLICY "perfis_super_admin_write" ON "public"."perfis" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



ALTER TABLE "public"."produtos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "produtos_admin_write" ON "public"."produtos" TO "authenticated" USING (("public"."is_super_admin"() OR (("public"."current_role"() = 'admin'::"text") AND ("restaurante_id" = "public"."auth_restaurante_id"())))) WITH CHECK (("public"."is_super_admin"() OR (("public"."current_role"() = 'admin'::"text") AND ("restaurante_id" = "public"."auth_restaurante_id"()))));



ALTER TABLE "public"."produtos_grupos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "produtos_select_public" ON "public"."produtos" FOR SELECT USING (true);



CREATE POLICY "public_read_adicionais" ON "public"."adicionais" FOR SELECT USING (true);



CREATE POLICY "public_read_grupos" ON "public"."grupos_adicionais" FOR SELECT USING (true);



CREATE POLICY "public_read_ipa" ON "public"."itens_pedido_adicionais" FOR SELECT USING (true);



CREATE POLICY "public_read_produtos_grupos" ON "public"."produtos_grupos" FOR SELECT USING (true);



ALTER TABLE "public"."restaurantes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurantes_select_all" ON "public"."restaurantes" FOR SELECT USING (true);



CREATE POLICY "restaurantes_super_admin_write" ON "public"."restaurantes" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "tenant_isolation" ON "public"."adicionais" USING (("public"."is_super_admin"() OR ("restaurante_id" = "public"."auth_restaurante_id"()))) WITH CHECK (("public"."is_super_admin"() OR ("restaurante_id" = "public"."auth_restaurante_id"())));



CREATE POLICY "tenant_isolation" ON "public"."grupos_adicionais" USING (("public"."is_super_admin"() OR ("restaurante_id" = "public"."auth_restaurante_id"()))) WITH CHECK (("public"."is_super_admin"() OR ("restaurante_id" = "public"."auth_restaurante_id"())));



CREATE POLICY "tenant_isolation" ON "public"."itens_pedido_adicionais" USING (("public"."is_super_admin"() OR ("restaurante_id" = "public"."auth_restaurante_id"()))) WITH CHECK (("public"."is_super_admin"() OR ("restaurante_id" = "public"."auth_restaurante_id"())));



CREATE POLICY "tenant_isolation" ON "public"."produtos_grupos" USING (("public"."is_super_admin"() OR ("restaurante_id" = "public"."auth_restaurante_id"()))) WITH CHECK (("public"."is_super_admin"() OR ("restaurante_id" = "public"."auth_restaurante_id"())));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comandas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."itens_pedido";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."auth_restaurante_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_restaurante_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_restaurante_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_place_order"("p_restaurante_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_place_order"("p_restaurante_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_place_order"("p_restaurante_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_item_pedido"("p_comanda_id" "uuid", "p_produto_id" "uuid", "p_quantidade" integer, "p_observacao" "text", "p_adicional_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."criar_item_pedido"("p_comanda_id" "uuid", "p_produto_id" "uuid", "p_quantidade" integer, "p_observacao" "text", "p_adicional_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_item_pedido"("p_comanda_id" "uuid", "p_produto_id" "uuid", "p_quantidade" integer, "p_observacao" "text", "p_adicional_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."current_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."itens_pedido_horario_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."itens_pedido_horario_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."itens_pedido_horario_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


















GRANT ALL ON TABLE "public"."adicionais" TO "anon";
GRANT ALL ON TABLE "public"."adicionais" TO "authenticated";
GRANT ALL ON TABLE "public"."adicionais" TO "service_role";



GRANT ALL ON TABLE "public"."categorias" TO "anon";
GRANT ALL ON TABLE "public"."categorias" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias" TO "service_role";



GRANT ALL ON TABLE "public"."comandas" TO "anon";
GRANT ALL ON TABLE "public"."comandas" TO "authenticated";
GRANT ALL ON TABLE "public"."comandas" TO "service_role";



GRANT ALL ON TABLE "public"."grupos_adicionais" TO "anon";
GRANT ALL ON TABLE "public"."grupos_adicionais" TO "authenticated";
GRANT ALL ON TABLE "public"."grupos_adicionais" TO "service_role";



GRANT ALL ON TABLE "public"."horarios_funcionamento" TO "anon";
GRANT ALL ON TABLE "public"."horarios_funcionamento" TO "authenticated";
GRANT ALL ON TABLE "public"."horarios_funcionamento" TO "service_role";



GRANT ALL ON TABLE "public"."itens_pedido" TO "anon";
GRANT ALL ON TABLE "public"."itens_pedido" TO "authenticated";
GRANT ALL ON TABLE "public"."itens_pedido" TO "service_role";



GRANT ALL ON TABLE "public"."itens_pedido_adicionais" TO "anon";
GRANT ALL ON TABLE "public"."itens_pedido_adicionais" TO "authenticated";
GRANT ALL ON TABLE "public"."itens_pedido_adicionais" TO "service_role";



GRANT ALL ON TABLE "public"."mesas" TO "anon";
GRANT ALL ON TABLE "public"."mesas" TO "authenticated";
GRANT ALL ON TABLE "public"."mesas" TO "service_role";



GRANT ALL ON TABLE "public"."perfis" TO "anon";
GRANT ALL ON TABLE "public"."perfis" TO "authenticated";
GRANT ALL ON TABLE "public"."perfis" TO "service_role";



GRANT ALL ON TABLE "public"."produtos" TO "anon";
GRANT ALL ON TABLE "public"."produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos" TO "service_role";



GRANT ALL ON TABLE "public"."produtos_grupos" TO "anon";
GRANT ALL ON TABLE "public"."produtos_grupos" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos_grupos" TO "service_role";



GRANT ALL ON TABLE "public"."restaurantes" TO "anon";
GRANT ALL ON TABLE "public"."restaurantes" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurantes" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































