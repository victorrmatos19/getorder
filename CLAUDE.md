# GetOrder — CLAUDE.md

> Contexto completo do projeto para o Claude Code.
> Leia este arquivo antes de qualquer alteração no código.

---

## 🎯 Visão geral do produto

**GetOrder** é um SaaS multi-tenant de comandas digitais via QR Code para bares, cervejarias artesanais, restaurantes e arenas esportivas (beach tennis, padel, society) no Brasil.

**Proposta de valor:** cliente final escaneia QR Code da mesa, faz pedidos pelo próprio celular (sem app, sem cadastro), cozinha recebe em tempo real, garçom é liberado do papel de anotador.

**Posicionamento comercial:**
- R$ 199/mês, sem fidelidade, sem taxa por pedido
- Funciona com qualquer maquininha (não processa pagamento)
- Sistema atende cliente piloto: **637 Cerveja Artesanal** (cervejaria com restaurante + quadras de beach tennis)

**Domínio comercial:** getorder.com.br (em configuração)

---

## 🏗️ Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Linguagem | TypeScript strict |
| Estilo | Tailwind CSS (sem libs de componentes) |
| Backend | Supabase (PostgreSQL + Realtime + Storage + Auth) |
| Estado server | TanStack Query (@tanstack/react-query) |
| Hospedagem frontend | Vercel (free tier) |
| Hospedagem backend | Supabase Pro ($25/mês) |
| Dev local | Supabase CLI + Docker (`npm run db:start`) — ver "Ambiente de desenvolvimento local" |
| QR Code | qrcode.react |
| Gráficos | recharts |
| Fontes | Cormorant Garamond + Work Sans (via next/font/google) |
| PWA (staff) | Serwist (`@serwist/next` + `serwist`) — ver "PWA (área do staff)" |

**Estrutura de pastas:**

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── manifest.ts            ← manifesto PWA (App Router) → /manifest.webmanifest
│   ├── sw.ts                  ← service worker (serwist) → gera public/sw.js no build
│   ├── login/
│   ├── mesa/[id]/              ← rota pública (cliente)
│   ├── cozinha/                ← protegida (cozinha/admin)
│   ├── garcom/                 ← protegida (garcom/admin)
│   │   ├── nova-comanda/        ← garçom: escolher mesa livre p/ nova comanda
│   │   ├── pedido/              ← garçom: lançar pedido (mesa nova OU comanda existente)
│   │   └── comanda/[id]/
│   ├── admin/                  ← protegida (admin)
│   │   ├── cardapio/
│   │   │   └── adicionais/      ← CRUD de grupos de adicionais
│   │   ├── mesas/
│   │   └── configuracoes/
│   ├── super-admin/            ← protegida (super_admin)
│   └── privacidade/            ← política LGPD pública
├── components/
│   ├── Logo.tsx
│   ├── PageHeader.tsx
│   ├── ProductCard.tsx         ← card "tap-to-open" do cardápio
│   ├── StatusBadge.tsx
│   ├── EmptyState.tsx
│   ├── ProtectedRoute.tsx
│   ├── InstallPrompt.tsx       ← convite de instalar a PWA (só staff)
│   └── providers/
│       └── QueryProvider.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           ← createBrowserClient
│   │   └── server.ts           ← createServerClient
│   ├── contexts/
│   │   └── RestauranteContext.tsx
│   ├── hooks/
│   │   ├── useComanda.ts
│   │   ├── useProdutos.ts
│   │   ├── useItens.ts
│   │   ├── useMesas.ts
│   │   ├── useAdicionais.ts        ← grupos + opções (admin)
│   │   ├── useProdutoGrupos.ts     ← vínculos produto↔grupo (admin)
│   │   ├── useProdutoOpcoes.ts     ← opções de um produto (cliente)
│   │   ├── useCozinhaAlerta.ts     ← som (Web Audio) + mudo + Wake Lock (cozinha)
│   │   └── useRestaurante.ts
│   ├── calcComanda.ts          ← subtotalItem / totalComanda (fonte única de total)
│   ├── itensPedido.ts          ← wrapper da RPC criar_item_pedido
│   ├── lancarPedidoGarcom.ts   ← wrapper da RPC lancar_pedido_garcom (lançamento pelo garçom)
│   └── formatters.ts           ← fmt.currency/money/moneyMask/moneyParse, cpf, time…
├── types/
│   └── index.ts
└── middleware.ts
```

---

## 🎨 Identidade visual — NUNCA alterar sem autorização explícita

**Paleta (em globals.css como CSS variables):**

```css
--primary:     #4A5240   /* verde oliva — cor da marca */
--primary-dk:  #2E3328   /* verde escuro — headers escuros */
--accent:      #9B4A3C   /* terracota — CTAs, preços, destaques */
--bg:          #FAF9F5   /* fundo principal */
--surface:     #F2F0E8   /* cards e superfícies */
--line:        #DDD9CC   /* bordas e divisores */
--muted:       #B8B5AB   /* textos secundários */
--text-mid:    #6B6A62   /* textos médios */
--ink:         #2A2A26   /* textos principais (nunca #000) */
```

**Tipografia:**
- Títulos: Cormorant Garamond, weight 500
- Corpo: Work Sans, weight 400 e 700
- Escala: 12 / 14 / 16 / 20 / 24 / 32px
- Sem pesos intermediários

**Princípios visuais:**
- Regra 60-30-10 (60% fundo neutro, 30% verde primário, 10% terracota)
- Grid de 8px em todo espaçamento
- Border-radius: 12px em cards, 8px em botões
- Nunca preto puro `#000` nem branco puro `#fff`
- Sem gradientes complexos, sem sombras excessivas
- Ícones em um único estilo (todos outline OU todos filled)

**UX inegociável (mobile-first):**
- Viewport base: 390px
- Fonte mínima: 16px
- Área de toque: mínimo 48×48px
- Espaçamento entre clicáveis: mínimo 12px
- Safe area no bottom para iPhone (`env(safe-area-inset-bottom)`)
- Nenhuma tela com scroll horizontal

---

## 🗄️ Modelo de dados (Supabase)

**Arquitetura multi-tenant:** row-level security (RLS) com `restaurante_id` em todas as tabelas operacionais.

### Tabelas principais

```sql
restaurantes (
  id uuid PK,
  nome text,
  slug text UNIQUE,
  logo_url text,
  ativo boolean,
  taxa_servico_percentual numeric(5,2) DEFAULT 10.00,
  taxa_servico_obrigatoria boolean DEFAULT false,
  pedidos_pausados boolean DEFAULT false,
  pausa_mensagem text,
  criado_em timestamptz
)

perfis (
  id uuid PK references auth.users(id),
  restaurante_id uuid references restaurantes(id),   -- NULL para super_admin
  role text CHECK (role IN ('super_admin','admin','garcom','cozinha'))
)

horarios_funcionamento (
  id uuid PK,
  restaurante_id uuid FK,
  dia_semana integer CHECK (0..6),   -- 0=domingo
  abre time,
  fecha time,
  fechado boolean,
  UNIQUE(restaurante_id, dia_semana)
)

mesas (
  id uuid PK,
  restaurante_id uuid FK,
  nome text,                          -- ex: "Mesa 5", "Quadra 2"
  ativo boolean,
  criado_em timestamptz
)

categorias (
  id uuid PK,
  restaurante_id uuid FK,
  nome text,
  emoji text,
  ordem integer,
  ativa boolean,
  criado_em timestamptz
)

produtos (
  id uuid PK,
  restaurante_id uuid FK,
  categoria_id uuid FK,
  nome text,
  descricao text NOT NULL DEFAULT '',   -- enviar '' quando vazia (NUNCA null) no form
  preco numeric(10,2),
  oferta_preco numeric(10,2),
  em_oferta boolean,
  novidade boolean,
  destaque_ordem integer DEFAULT 999,
  disponivel boolean,                   -- false = SOME do cardápio (indisponível)
  esgotado boolean DEFAULT false,       -- true = fica no cardápio, RISCADO, sem poder pedir (migration 012)
  ordem integer,
  foto_url text,
  criado_em timestamptz
)

comandas (
  id uuid PK,
  restaurante_id uuid FK,
  mesa_id uuid FK,
  cliente_nome text,
  cliente_cpf text,
  status comanda_status CHECK ('aberta','fechada','cancelada'),   -- ENUM; 'cancelada' = migration 014
  forma_pagamento text CHECK ('pix','debito','credito','dinheiro'),
  total numeric(10,2),
  numero_pessoas integer DEFAULT 1,
  taxa_servico_valor numeric(10,2),
  taxa_servico_aplicada boolean DEFAULT true,
  aceite_lgpd_em timestamptz,
  -- auditoria de cancelamento (migration 015 — prevenção de comanda-zumbi)
  cancelada_em timestamptz,
  cancelada_por uuid references auth.users(id),   -- null = sistema (job pg_cron)
  cancelamento_motivo text,                       -- 'expiracao_automatica' | 'cancelada_garcom'
  criado_em timestamptz,
  fechado_em timestamptz
)

itens_pedido (
  id uuid PK,
  restaurante_id uuid FK,
  comanda_id uuid FK,
  produto_id uuid FK,
  quantidade integer,
  obs text,
  status text CHECK ('novo','em_preparo','pronto','entregue','cancelado'),
  preco_base_snapshot numeric(10,2),   -- snapshot do preço base no momento do pedido
  cancelado_em timestamptz,
  cancelado_por uuid references auth.users(id),
  criado_em timestamptz
)

-- ── Adicionais estruturados (grupos reutilizáveis entre produtos) ──
grupos_adicionais (
  id uuid PK,
  restaurante_id uuid FK,
  nome text,                          -- ex: "Ponto da carne", "Adicionais", "Tirar"
  selecao text CHECK ('unica','multipla'),
  obrigatorio boolean DEFAULT false,
  min_escolhas int DEFAULT 0,
  max_escolhas int,                   -- null = sem teto
  ativo boolean DEFAULT true,
  criado_em timestamptz
)

adicionais (                          -- opções dentro de um grupo
  id uuid PK,
  restaurante_id uuid FK,
  grupo_id uuid FK references grupos_adicionais(id) on delete cascade,
  nome text,
  preco numeric(10,2) DEFAULT 0,      -- 0 = remoção ("sem cebola")
  disponivel boolean DEFAULT true,
  ordem int DEFAULT 0,
  criado_em timestamptz
)

produtos_grupos (                     -- junção: quais grupos se aplicam a quais produtos
  id uuid PK,
  restaurante_id uuid FK,
  produto_id uuid FK on delete cascade,
  grupo_id uuid FK on delete cascade,
  ordem int DEFAULT 0,
  UNIQUE(produto_id, grupo_id)
)

itens_pedido_adicionais (             -- snapshot imutável dos adicionais escolhidos
  id uuid PK,
  restaurante_id uuid FK,
  item_pedido_id uuid FK on delete cascade,
  adicional_id uuid FK on delete set null,   -- null se a opção original foi removida
  grupo_nome_snapshot text,
  nome_snapshot text,
  preco_snapshot numeric(10,2) DEFAULT 0,
  criado_em timestamptz
)
```

### RPC `criar_item_pedido` (criação de item — fluxo do cliente)

⚠️ **O cliente NUNCA insere direto em `itens_pedido`.** Todo item criado pelo fluxo
de `/mesa/[id]` passa pela função `criar_item_pedido(p_comanda_id, p_produto_id,
p_quantidade, p_observacao, p_adicional_ids[])` (`SECURITY DEFINER`). Ela:
- resolve o `restaurante_id` a partir da comanda e valida comanda aberta + produto disponível
  **e não esgotado** (recusa com `'Produto esgotado'` — migration 012);
- **anti-tampering**: cada `adicional_id` precisa pertencer a um grupo **ativo** vinculado ao
  produto, do mesmo restaurante, e estar disponível;
- valida as regras de cada grupo (obrigatório / min / max / única);
- insere o item com `preco_base_snapshot = produtos.preco` e grava o **snapshot** de cada
  adicional (`nome_snapshot`, `preco_snapshot`, `grupo_nome_snapshot`) lendo o preço **real**
  do banco — o frontend só envia os **IDs**, nunca preço.

O gatilho `itens_pedido_horario_guard` continua valendo, **mas só bloqueia quando `auth.uid()` é
nulo** (cliente anônimo): `if new.status = 'novo' and auth.uid() is null then can_place_order(...)`.
Logo o cliente fica gated por pausa/fora de horário; **o staff autenticado (garçom) NÃO** — pode
lançar pedido manual mesmo com pedidos pausados (balcão/telefone). Wrapper tipado em `lib/itensPedido.ts`.

> ⚠️ Limitação conhecida: a RPC faz snapshot de `produtos.preco`, **ignorando** `em_oferta`/
> `oferta_preco`. Ofertas hoje são só display no card; não incidem no pedido.

### RPC `lancar_pedido_garcom` (lançamento manual pelo garçom — migration 013)

O garçom lança pedidos pela tela de staff (atendimento na mesa, balcão/telefone) via
`lancar_pedido_garcom(p_comanda_id, p_mesa_id, p_itens jsonb) RETURNS uuid` (`SECURITY DEFINER`,
transacional). Ela:
- resolve o `restaurante_id` via `auth_restaurante_id()` e exige papel `admin`/`garcom`;
- **find-or-create da comanda 'aberta' da mesa** (modelo mesa fixa) quando recebe `p_mesa_id`; ou
  usa `p_comanda_id` (valida tenant + `status='aberta'`);
- para cada item de `p_itens` (`{produto_id, quantidade, observacao, adicionais:[uuid…]}`) chama a
  `criar_item_pedido` existente (preço/validação/snapshot no servidor) — **uma transação**, erro =
  rollback total; retorna o id da comanda.
- Sem policy nova: o garçom já lê `mesas` (público) e `comandas` do tenant; a escrita é via
  SECURITY DEFINER. Wrapper tipado em `lib/lancarPedidoGarcom.ts` (frontend só manda IDs).

### Prevenção de comanda-zumbi — Caso 1: comanda VAZIA (migrations 014/015)

No modelo mesa-fixa, uma comanda `aberta` **sem itens** (cliente escaneou por curiosidade, ou
garçom abriu e abandonou) deixa a mesa "ocupada" e polui o painel. Como não há nada devido, é
seguro cancelar:
- **Status novo `cancelada`** no enum `comanda_status` + colunas de auditoria (`cancelada_em`,
  `cancelada_por`, `cancelamento_motivo`). `cancelada` **nunca** entra em faturamento.
- **Job pg_cron `expirar_comandas_vazias()`** (`*/5 * * * *`): cancela comandas `aberta` **sem
  itens** com `criado_em > 30 min` (`motivo='expiracao_automatica'`). Guard de race: `not exists
  (itens)` — se um item entrar antes do job, a comanda **não** é cancelada. Threshold global no MVP.
- **RPC `cancelar_comanda_vazia(p_comanda_id)`** (`SECURITY DEFINER`): cancelamento manual do
  garçom/admin, **só** em comanda vazia do próprio tenant (`auth_restaurante_id()` + `status='aberta'`
  + `not exists` itens); erro claro se tiver itens. Wrapper `lib/cancelarComandaVazia.ts`.
- **UI:** em `/garcom/comanda/[id]`, quando a comanda está **vazia**, o rodapé mostra "Cancelar
  comanda vazia" (no lugar de "Encerrar e Cobrar"). Mesa volta a aparecer livre (cancelada ≠ aberta).
- ⚠️ **Comandas COM itens nunca são tocadas** — fecham via "Encerrar e cobrar". Caso 2 (comanda com
  itens abandonada) está **fora de escopo** no MVP.
- Dashboard não precisou mudar: faturamento usa `status='fechada'`, e as queries por item só veem
  comandas que têm itens (cancelada é vazia).

### RLS — Row Level Security

**Funções helper:**

```sql
auth_restaurante_id()  -- retorna restaurante_id do usuário logado
is_super_admin()       -- retorna true se role = 'super_admin'
current_role()         -- retorna o role (perfis.role) do usuário logado
```

**Modelo de leitura (migrations 008–011) — CARDÁPIO público, VENDAS escopadas:**

O `/mesa/[id]` é **público por design** e precisa funcionar para **qualquer** visitante
(anônimo OU autenticado em outro tenant). Por isso o SELECT é dividido:

- **Cardápio/display = leitura pública `using (true)`** (migration 008): `produtos`, `categorias`,
  `mesas`, `restaurantes`, `horarios_funcionamento`, `grupos_adicionais`, `adicionais`,
  `produtos_grupos`. Dados não sensíveis (já públicos no QR). Policies `<tabela>_select_public`.
  > ⚠️ Não voltar a escopar essas leituras por tenant — quebra o cliente logado em outro
  > restaurante ("Mesa indisponível"). O isolamento das telas admin vem do filtro explícito
  > `.eq('restaurante_id', …)` nas queries, não da RLS de leitura.
- **Vendas = leitura ESCOPADA por tenant** (migration 008): `comandas`, `itens_pedido`,
  `itens_pedido_adicionais`. Policy `<tabela>_select_scoped`:
  `auth.uid() is null OR is_super_admin() OR restaurante_id = auth_restaurante_id()`
  (cliente anônimo lê a própria comanda; staff só o próprio restaurante → dashboard/garçom/cozinha
  não vazam vendas entre tenants).

**Escrita (servidor é a fonte da verdade):**
- `tenant_isolation` / `<tabela>_admin_write`: escrita restrita ao próprio restaurante (super_admin
  vê tudo). Aplicada em `produtos`, `categorias`, `mesas`, `grupos_adicionais`, `adicionais`,
  `produtos_grupos`, `itens_pedido_adicionais` etc.
- **Trigger `force_tenant_on_write` (migration 009):** em INSERT/UPDATE dessas tabelas, para um
  autenticado não-super-admin, **carimba `restaurante_id := auth_restaurante_id()`** (ignora o que
  o client mandou). Service-role (`auth.uid()` nulo) e super_admin passam. → impossível gravar em
  outro tenant ou levar "violates row-level security" por id errado.
- **`restaurantes` (migration 011):** super_admin tem `restaurantes_super_admin_write` (ALL); o
  admin do restaurante tem `restaurantes_admin_update` (atualiza **só o próprio** — configs de
  taxa/pausa). Trigger `protect_restaurante_super_fields` impede o admin de mudar `slug`/`ativo`.
- `public_insert_comandas` / `public_insert_itens`: clientes anônimos inserem comandas/itens.
- ⚠️ **Sem** insert público em `itens_pedido_adicionais`: a escrita acontece **só** pela RPC acima.

**Storage (migration 010):** bucket público `produtos` com policies em `storage.objects`
(`produtos_public_read` + escrita autenticada). As policies de storage agora são **versionadas**
(antes só existiam no painel do PRD → upload de foto falhava no ambiente local).

⚠️ **CRÍTICO:** Toda nova tabela com dados de restaurante DEVE incluir:
1. Coluna `restaurante_id uuid NOT NULL REFERENCES restaurantes(id)`
2. Índice em `restaurante_id`
3. `ENABLE ROW LEVEL SECURITY`
4. Policy de escrita por tenant + (se for tabela de **venda**) SELECT escopado; se for **cardápio**,
   SELECT público. Considerar o trigger `force_tenant_on_write` para carimbar o `restaurante_id`.

### Realtime

Habilitado nas tabelas:
- `itens_pedido` — usado pela cozinha e pela aba "Minha Comanda"
- `comandas` — para detectar fechamento da comanda

**Padrão de uso:**

```typescript
useEffect(() => {
  const channel = supabase
    .channel('canal-unico')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'itens_pedido'
    }, () => refetch())
    .subscribe()
  
  return () => { channel.unsubscribe() }  // SEMPRE
}, [])
```

---

## 🛣️ Rotas e responsabilidades

### Públicas (sem auth)

| Rota | Função |
|---|---|
| `/mesa/[id]` | Cliente: abertura direta na mesa + cardápio + acompanhamento |
| `/privacidade` | Política de privacidade LGPD |
| `/login` | Login para usuários internos |

### Protegidas por role

| Rota | Roles permitidos |
|---|---|
| `/cozinha` | admin, cozinha |
| `/garcom`, `/garcom/comanda/[id]`, `/garcom/nova-comanda`, `/garcom/pedido` | admin, garcom |
| `/admin/*` | admin |
| `/super-admin/*` | super_admin |

**Middleware:** `src/middleware.ts` verifica sessão Supabase + role na tabela `perfis`. Não autenticado → `/login`. Role insuficiente → `/login?error=unauthorized`.

---

## 📱 Fluxos críticos de negócio

### 1. Cliente faz pedido (/mesa/[id])

```
1. Lê mesa_id da URL params
2. Abertura direta na mesa (find-or-create) — SEM identificação:
   → Busca a comanda 'aberta' da mesa (mesa_id + status='aberta', mais recente)
   → Se existir: entra nela (comanda compartilhada da mesa)
   → Se não existir: INSERT anônimo em comandas
     (apenas mesa_id, restaurante_id da mesa e status='aberta')
   → NÃO coleta nome, CPF nem aceite LGPD; não usa localStorage
3. Cai direto no cardápio
4. Cardápio:
   - Verifica restaurante.pedidos_pausados → se true, bloqueia novos pedidos
   - Verifica horarios_funcionamento do dia → se fora, bloqueia
   - Lista produtos disponíveis, agrupados por categoria
   - Seções de destaque: 🆕 Novidades, 🔥 Em Oferta (se houver)
   - Cada produto é um card "tap-to-open" → abre a TELA DE DETALHE (padrão único,
     com ou sem adicionais)
5. Tela de detalhe do produto (ProdutoDetalhe, full screen):
   - Carrega os grupos vinculados (ativos) + opções disponíveis, ordenados
   - selecao 'unica' → radio; 'multipla' → checkbox (bloqueia acima de max_escolhas)
   - Validação no client espelhando a RPC: botão desabilitado enquanto grupo
     obrigatório não atende min; total recalculado ao vivo (helper calcComanda)
   - Observação livre (até 200 chars) + quantidade
   - "Adicionar ao pedido" → adiciona ao CARRINHO local (não envia ainda)
6. Carrinho + envio:
   - Barra "Ver pedido" → modal lista as linhas (adicionais + obs + subtotais), remover por linha
   - "Enviar pedido" dispara `criar_item_pedido` (RPC) para CADA linha; falha parcial
     remove as enviadas e mantém o resto. O frontend só manda os IDs dos adicionais.
7. Aba "Minha Comanda":
   - Itens agrupados por rodada (≤2min entre criados), com os adicionais sob cada item
   - Total via helper `calcComanda` (subtotalItem/totalComanda) — mesma fonte do garçom/checkout
   - Realtime: status atualiza automaticamente
   - Cliente pode cancelar item com status 'novo' (UPDATE com guard WHERE status='novo')
   - Botão "Solicitar conta" → toast (sem ação backend ainda)
   - Botão "Sair" → estado "Você saiu da comanda" (não fecha a comanda no banco;
     reescanear/voltar reentra na comanda aberta da mesa)
```

**IMPORTANTE — uma comanda compartilhada por mesa (modo mesa fixa):**
A versão atual foca em **restaurantes tradicionais com mesas fixas**. A comanda é aberta
direto na mesa, sem identificação: **todos os celulares da mesma mesa entram na MESMA
comanda** e somam na mesma conta. O garçom fecha **uma conta por mesa**.
A identidade visível da comanda é a **mesa** (ex.: "Mesa 5"), não o cliente.

`cliente_nome`/`cliente_cpf` agora são **opcionais** (nullable) e ficam nulos no fluxo
do cliente. As telas de staff (garçom/cozinha/checkout) usam a mesa como identidade e
fazem fallback quando o nome é nulo. Comandas legadas com nome/CPF continuam sendo
exibidas normalmente.

> ⚠️ O modelo antigo "cada CPF = comanda independente" (beach tennis, várias comandas
> por quadra) foi **descontinuado nesta versão**. Para reintroduzi-lo no futuro, o caminho
> é um toggle por restaurante (ex.: `exigir_identificacao`); o `IdentificacaoForm` está
> recuperável no histórico do git.

### 2. Cozinha (/cozinha)

```
1. Tema escuro obrigatório (fundo --primary-dk)
2. KANBAN: as 3 colunas Novos | Preparando | Prontos visíveis AO MESMO TEMPO (cada
   uma com scroll próprio) — não são mais abas que trocam (paisagem/tablet)
3. Query: itens_pedido JOIN produtos JOIN comandas JOIN mesas + itens_pedido_adicionais (nested)
   WHERE status IN ('novo','em_preparo','pronto')
4. Cards mostram: mesa/quadra, itens com ADICIONAIS e OBSERVAÇÃO em destaque (peso 700, terracota)
5. Tempo > 15min → cor de urgência
6. Botões transitam status:
   novo → em_preparo → pronto → entregue (some)
7. Realtime ativo
8. ALERTA SONORO (hook useCozinhaAlerta): toca um chime sintetizado (Web Audio) SÓ em
   INSERT de itens_pedido (pedido novo), com debounce (vários itens do mesmo pedido = 1 toque).
   - Autoplay: precisa de gesto p/ liberar o áudio (botão "🔔 Ativar som" no header, ou 1º toque);
     depois um toggle de mudo (🔔/🔕) persiste em localStorage (`cozinha_som_mudo`).
   - Wake Lock mantém a tela acesa (re-adquire ao voltar o foco); degrada onde não há suporte.
   - Indicador de conexão realtime no header (🟢 Ao vivo / 🟠 Reconectando / 🔴 Sem conexão).
```

**⚠️ Observações em destaque:** na cozinha, o campo `obs` (e os adicionais escolhidos) deve ser exibido em peso 700, cor --accent. Operador NÃO pode perder isso.

**⚠️ Som só em INSERT:** o alerta dispara **apenas** quando chega item novo (evento INSERT do
Realtime); UPDATE (mover card) e a carga inicial (useQuery) **não** tocam.

### 3. Garçom (/garcom)

```
1. Lista mesas com comandas abertas
2. Agrupado por mesa, mostrando todas as comandas se múltiplas:
   - Quadra 2 (2 comandas)
     · Ana Paula · R$ 96,00
     · Rafael M. · R$ 54,00
3. Card INTEIRO VERDE (texto branco) quando há item 'pronto' para entregar (chamativo);
   visual neutro (creme) quando não há nada pronto. Badge "N prontos" claro sobre o verde.
4. Header tem botão "Nova comanda" (→ /garcom/nova-comanda) para o garçom lançar pedido.
```

### 3b. Garçom lança pedido (/garcom/nova-comanda e /garcom/pedido)

```
- /garcom/nova-comanda → lista as mesas ATIVAS sem comanda aberta (busca + 3 estados);
  toque → /garcom/pedido?mesa=<id>
- /garcom/pedido?mesa=<id>  (mesa nova) OU ?comanda=<id> (comanda existente):
  · busca + chips de categoria; reaproveita ProductCard (trata esgotado) e ProdutoDetalhe
    (bottom-sheet de adicionais obrigatórios/opcionais + obs + quantidade); carrinho LOCAL.
  · "Lançar pedido" → lancar_pedido_garcom (1 transação, só IDs) → router.push p/
    /garcom/comanda/<id> + toast "Pedido lançado para a cozinha". Erro mantém o carrinho.
- /garcom/comanda/[id] → botão "Novo pedido" no rodapé (→ /garcom/pedido?comanda=<id>).
- A comanda só é criada/efetivada no "Lançar pedido" (find-or-create) — evita comanda-zumbi.
- O layout /garcom (src/app/garcom/layout.tsx) provê RestauranteProvider (tenant) para essas telas.
```

### 4. Comanda detalhada (/garcom/comanda/[id])

```
1. Header: mesa como identidade (+ nome e CPF parcial apenas em comandas legadas)
2. Histórico agrupado por rodada (com os adicionais e o subtotal de cada item via helper)
3. Modal "Encerrar e Cobrar":
   - Toggle taxa de serviço (configurável por restaurante)
   - Stepper "Número de pessoas" para divisão igual
   - Seleção forma pagamento (PIX/Débito/Crédito/Dinheiro)
   - Se dinheiro: campo "Valor recebido" + troco automático
   - Confirmar:
     UPDATE comandas SET status='fechada', total=X, forma_pagamento=Y, 
            taxa_servico_valor=Z, numero_pessoas=N, fechado_em=now()
     UPDATE todos itens SET status='entregue'
4. Tela de sucesso animada
```

### 5. Admin (/admin)

```
- /admin                     → Dashboard: faturamento dia, pedidos, produto top, mesa top, gráfico por hora
- /admin/cardapio            → CRUD produtos + categorias, toggle disponível + toggle "Esgotado",
                               upload de foto; no editor: seção "Adicionais e opções" (vincular grupos)
                               e checkbox "Esgotado (sem estoque hoje)"; inputs de preço com
                               máscara de moeda (R$) — ver "Formatação"
- /admin/cardapio/adicionais → CRUD de grupos de adicionais reutilizáveis + suas opções
- /admin/mesas               → CRUD mesas, gerar QR Code com qrcode.react
- /admin/configuracoes       → Taxa, horário, pausa de pedidos
```

### 6. Super Admin (/super-admin)

```
- /super-admin                        → Lista restaurantes
- /super-admin/restaurantes/novo      → Cria restaurante + 1º usuário admin
- /super-admin/restaurantes/[id]      → Edita, lista usuários, ativa/desativa
```

**Rota `POST /api/super-admin/restaurantes`** (`createAdminClient` / service role): cria o
restaurante + **categorias padrão** + **horários padrão (7 dias abertos, 00:00–23:59)** + usuário
admin + perfil. Os horários são essenciais: sem eles o cliente vê "Fora do horário de funcionamento"
e não pede (`useDisponibilidade` trata dia sem horário como fechado). Logo, **todo restaurante novo
já nasce operacional**; o admin refina depois em `/admin/configuracoes → Horário`.
- ⚠️ Exige `SUPABASE_SERVICE_ROLE_KEY` no ambiente (Vercel → Environment Variables, **Production**).
  Sem ela, `createAdminClient()` lança e a rota retorna 500; o frontend trata e mostra mensagem clara.

---

## 🔐 Segurança e LGPD

### Autenticação
- Supabase Auth com email + senha
- Sem cadastro público de usuários internos (criados manualmente ou via super_admin)
- Clientes finais NÃO autenticam nem se identificam (comanda aberta direto na mesa)

### LGPD
- Coleta atual: apenas dados de pedidos (sem nome/CPF no fluxo do cliente)
- `comandas.aceite_lgpd_em` permanece nullable; fica nulo nas comandas abertas direto na mesa
- Campos `cliente_nome`/`cliente_cpf` são nullable e preservam comandas legadas
- Política em `/privacidade` (revisar para refletir a menor coleta de dados)
- Sistema é **operador** dos dados (responsabilidade compartilhada com restaurante)

### O que NÃO está implementado (responsabilidade do restaurante)
- ❌ Emissão de NFC-e/Cupom Fiscal
- ❌ Processamento real de pagamento (sistema apenas registra forma)
- ❌ Integração com maquininhas

⚠️ **Cláusula contratual:** o restaurante é responsável pela emissão fiscal. GetOrder apenas calcula e exibe valores.

---

## 📲 PWA (área do staff)

A **área autenticada** (cozinha/garçom/admin/super-admin) é uma **PWA instalável** (ícone na tela
inicial, abre em `standalone`/tela cheia, splash com as cores da marca). O **fluxo público do
cliente** (`/mesa/[id]`, `/privacidade`, `/login`) **NÃO** convida à instalação — segue site comum.
Lib: **Serwist** (`@serwist/next` + `serwist`), sucessor mantido do `next-pwa`.

**Peças:**
- `src/app/manifest.ts` — manifesto (App Router) → `/manifest.webmanifest`. `display: standalone`,
  `start_url: /login` (entrada do staff, **não** `/mesa`), `scope: /`, `theme_color #4A5240`,
  `background_color #FAF9F5`, ícones 192/512 + **maskable**.
- `src/app/sw.ts` — service worker **conservador** (gerado em `public/sw.js` no build):
  - precache **só** dos assets estáticos imutáveis do build (`/_next/static/*`);
  - navegação (HTML) → `NetworkFirst`; **TODO o resto, inclusive Supabase → `NetworkOnly`**.
  - ⚠️ **Dados de pedido/Supabase NUNCA vêm de cache** — sempre rede. Não introduzir cache
    agressivo (StaleWhileRevalidate/`defaultCache`) que sirva pedido velho.
- `src/components/InstallPrompt.tsx` — convite discreto/dismissível (paleta, toque 48px, safe-area),
  escuta `beforeinstallprompt`, detecta **iOS** (mostra "Compartilhar → Adicionar à Tela de Início").
  Montado **APENAS** por baixo do `ProtectedRoute` das rotas de staff (admin/super-admin layouts;
  cozinha/garçom pages). **Nunca** em `/mesa`, `/privacidade`, `/login`.
- `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` — derivados
  do símbolo do `Logo` (comanda) sobre o verde oliva.
- `next.config.mjs` — `withSerwistInit({ swSrc: 'src/app/sw.ts', swDest: 'public/sw.js', disable:
  NODE_ENV==='development' })`. `tsconfig.json` — `webworker` no lib + `@serwist/next/typings` em
  `types`. `public/sw.js` é **gerado no build** (gitignored).

**Regras / gotchas:**
- ⚠️ **`minimatch` é dependency explícita** (`package.json`) — a Vercel não a inclui por padrão e o
  build do serwist falha sem ela.
- ⚠️ **Não testar PWA com `next dev`** — o serwist fica **desabilitado em dev** de propósito (evita
  SW servir build velho). Testar com `next build && next start`.
- ⚠️ **Service Worker exige contexto seguro** (HTTPS ou `localhost`). Em `http://<IP-da-LAN>` o SW
  **não registra** → para testar no celular use a **produção (Vercel, HTTPS)** ou um túnel HTTPS.
  (iOS: "Adicionar à Tela de Início" funciona mesmo em HTTP, mas Android/instalação precisa do SW.)
- Instalabilidade é **por origem** (manifesto global no root layout); o controle "só staff" é da
  **UI** (`InstallPrompt`), não do manifesto.
- ✅ **Som de pedido novo e Wake Lock JÁ implementados** na cozinha (hook `useCozinhaAlerta`) — são
  client-side (Web Audio / Screen Wake Lock), independentes do service worker.
- **Ainda fora de escopo:** Web Push, offline de dados (roadmap).

---

## 🚀 Deploy e ambiente

### Produção
- **Frontend:** Vercel (auto-deploy via `git push` na branch `main`)
- **Backend:** Supabase Pro (backup diário automático)
- **DNS:** Registro.br → `getorder.com.br` (apontando para Vercel)

### Variáveis de ambiente

Três vars (usadas em `lib/supabase/client.ts`, `server.ts` e `admin.ts`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # só server-side (rota super-admin)
```

- **`.env.local`** = ambiente **ativo** do `next dev`. Por padrão aponta para o **Supabase local**
  (Docker). Backup das credenciais de PRODUÇÃO em **`.env.prd.local`**.
- Trocar local↔PRD: `cp .env.prd.local .env.local` (e reiniciar o `next dev`).
- Vercel (produção) usa suas próprias Environment Variables — não lê `.env.local`.

⚠️ **NUNCA** commitar `.env*.local` (gitignored). Sempre usar `NEXT_PUBLIC_` no prefix das vars que vão pro client.
⚠️ **NUNCA** usar `SUPABASE_SERVICE_ROLE_KEY` no frontend. Bypassa RLS.
⚠️ **`SUPABASE_SERVICE_ROLE_KEY` precisa estar no Vercel (Production).** É segredo server-side
(sem `NEXT_PUBLIC_`), então **não** vai junto com o deploy do código — cadastrar à parte em
Environment Variables. Sem ela, a rota `POST /api/super-admin/restaurantes` falha (criar restaurante).

### Supabase Auth Configuration
- Site URL: `https://getorder.com.br` (ou domínio Vercel)
- Redirect URLs: `https://getorder.com.br/**` e `https://*.vercel.app/**`

### Ambiente de desenvolvimento local (Supabase CLI + Docker)

O stack inteiro (Postgres + Auth + Storage + Studio) roda em Docker via Supabase CLI
(instalada como devDependency; rodar com `npx supabase`). **Use o local para desenvolver e
pare de alterar o PRD.**

```bash
npm run db:start     # sobe o stack local (Docker)
npm run dev          # app contra o banco LOCAL
npm run db:stop      # desliga o stack
npm run db:reset     # recria o banco do baseline + recarrega seed.sql (zera mudanças locais)
npm run db:status    # mostra URLs e chaves locais
```

- **Studio (ver/editar dados):** http://127.0.0.1:54323 · **API:** http://127.0.0.1:54321 ·
  **Mailpit (e-mails de teste):** http://127.0.0.1:54324
- **Login local:** mesmos e-mail/senha do PRD (os usuários foram replicados no seed).
- As fotos **antigas do 637** não carregam local (só os registros de Storage vieram no seed, não os
  arquivos). Mas **upload e exibição de fotos novas funcionam local** (migration 010 + host local no
  `next.config.mjs`).

**Schema & migrations (importante):**
- As migrations 001–007 (aplicadas no PRD na mão) foram **squashadas** num único baseline:
  `supabase/migrations/00000000000000_baseline.sql` = **dump do schema do PRD** (fonte da verdade).
  As antigas viraram histórico em `supabase/migrations_archive/` (fora do caminho de `db reset`).
- Migrations **008–011** (em cima do baseline) — isolamento multi-tenant correto. Idempotentes
  (`drop ... if exists` + `create`):
  - `008_rls_select_tenant_scope.sql` — leitura: cardápio público, vendas escopadas (ver seção RLS).
  - `009_force_tenant_on_write.sql` — trigger que carimba `restaurante_id` nas escritas de admin.
  - `010_storage_policies.sql` — policies do bucket `produtos` (upload de foto).
  - `011_restaurantes_admin_update.sql` — admin salva configs do próprio restaurante; protege `slug`/`ativo`.
  - `012_add_produto_esgotado.sql` — coluna `produtos.esgotado` + guarda `'Produto esgotado'` na RPC `criar_item_pedido`.
  - `013_lancar_pedido_garcom.sql` — RPC `lancar_pedido_garcom` (lançamento manual pelo garçom).
  - `014_comanda_status_cancelada.sql` — valor `'cancelada'` no enum `comanda_status` (separada: enum só usável após commit).
  - `015_prevencao_comanda_zumbi.sql` — auditoria + job pg_cron `expirar_comandas_vazias()` + RPC `cancelar_comanda_vazia`.
- `supabase/seed.sql` = dump dos **dados do PRD** (public + auth). **Gitignored** (dados reais +
  hashes). Para recriá-lo: `npx supabase db dump --linked --data-only -f supabase/seed.sql`.

**Fluxo de mudança de banco (fim do "SQL na mão em produção"):**
```bash
npx supabase migration new minha_mudanca   # cria SQL em supabase/migrations/
npm run db:reset                            # testa local
npm run db:push                             # aplica no PRD (supabase db push)
```
> ✅ **Histórico do PRD reconciliado**: as antigas 001–007 foram marcadas `reverted` no remoto via
> `migration repair` (existem só em `migrations_archive/`); baseline + 008–013 são o histórico ativo.
> Daqui pra frente, mudança de banco é **sempre** `migration new` → `db:reset` (testa local) →
> `db:push`. **Não** rodar mais SQL na mão no PRD.
>
> ⚠️ **db:push após mexer nas migrations:** se o `db push` reclamar de "Remote migration versions not
> found", rode `npx supabase migration repair --status reverted <versões>` (bookkeeping, não altera
> schema) e repita o `db:push`.

> 🔑 **Login local nas telas de staff:** o seed traz hashes do PRD; antes de logar local, resetar as
> senhas: `update auth.users set encrypted_password = crypt('Teste1234', gen_salt('bf'));` e entrar
> com `Teste1234` (o `db:reset` recarrega o seed e zera isso — só no LOCAL, nunca no PRD).

---

## 📐 Padrões de código

### Componentes

```typescript
// Padrão: componente funcional + tipagem explícita das props
type ProductCardProps = {
  produto: Produto
  onAdd: (qtd: number, obs?: string) => void
}

export function ProductCard({ produto, onAdd }: ProductCardProps) {
  // ...
}
```

### Queries TanStack

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['produtos', restauranteId],
  queryFn: async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('produtos')
      .select('*, categoria:categorias(*)')
      .eq('restaurante_id', restauranteId)
      .eq('disponivel', true)
      .order('destaque_ordem', { ascending: true })
    
    if (error) throw error
    return data
  },
  staleTime: 30_000,
})
```

### Estados obrigatórios em listas

Toda lista deve tratar:
- **Loading:** skeleton ou spinner
- **Vazio:** componente `EmptyState`
- **Erro:** mensagem + botão "Tentar novamente"

### Formatação

Sempre usar helpers de `lib/formatters.ts`:

```typescript
fmt.currency(v)        // R$ 18,00 (com símbolo)
fmt.money(v)           // 1.850,00 (número → string, sem símbolo; p/ valor inicial de input)
fmt.moneyMask(raw)     // input cru → máscara em centavos (digita "1850" → "18,50") — onChange
fmt.moneyParse(masked) // string mascarada → número (robusto a milhar/vírgula) — no submit
fmt.cpf(v)             // 123.456.789-00
fmt.cpfMask(v)         // máscara dinâmica em input
fmt.time(v)            // 19h32
fmt.elapsed(v)         // 12min, 1h05min
```
> 💰 **Inputs de dinheiro** (preço, oferta, adicional, "valor recebido"): SEMPRE auto-máscara em
> centavos via `fmt.moneyMask` no `onChange` e `fmt.moneyParse` no submit (nunca `parseFloat` cru —
> quebra com separador de milhar). A taxa de serviço é **percentual**, não usa essa máscara.

### Cálculo de total — SEMPRE via `lib/calcComanda.ts`

Nunca somar item na mão. Usar os helpers (fonte única para cliente, garçom e checkout):

```typescript
subtotalItem(item)   // (preco_base_snapshot ?? produto.preco) + Σ adicionais.preco_snapshot, × qtd
totalComanda(itens)  // soma os subtotais dos itens não cancelados
```
Itens legados (sem `preco_base_snapshot`) caem no fallback `produto.preco`.

---

## ✅ Funcionalidades implementadas

- [x] Multi-tenant com RLS (cardápio público + vendas escopadas; escrita carimba o tenant no
      servidor via trigger `force_tenant_on_write`; admin gerencia só o próprio restaurante)
- [x] Onboarding de restaurante novo via super-admin: cria categorias **e horários padrão** →
      já nasce operacional; isolamento validado ponta-a-ponta (roteiro Suite 16)
- [x] Autenticação 4 roles (super_admin, admin, garcom, cozinha)
- [x] Fluxo cliente: abertura direta na mesa + cardápio + pedido + acompanhamento
- [x] Cardápio com fotos (Supabase Storage)
- [x] Categorias dinâmicas + ofertas + novidades
- [x] Realtime na cozinha
- [x] Comanda compartilhada por mesa (modo mesa fixa)
- [x] Garçom: lista de mesas + comanda detalhada
- [x] Modal de cobrança com taxa e divisão de conta
- [x] Admin: dashboard + cardápio + mesas + configurações
- [x] QR Code generator por mesa
- [x] Super-admin para gerenciar restaurantes
- [x] LGPD: política de privacidade (aceite descontinuado no fluxo do cliente)
- [x] Cancelamento de item antes do preparo
- [x] Observação livre por item (com destaque na cozinha)
- [x] Taxa de serviço configurável
- [x] Horário de funcionamento + pausa de pedidos
- [x] Adicionais estruturados: grupos reutilizáveis (única/múltipla, obrig., min/max),
      opções com preço, vínculo a produtos; tela de detalhe + carrinho no cliente;
      cálculo/validação/snapshot 100% no servidor (RPC `criar_item_pedido`)
- [x] Cálculo de total centralizado em `lib/calcComanda.ts` (cliente, garçom e checkout)
- [x] PWA instalável na área do staff (Serwist): manifesto standalone, SW conservador
      (dados sempre da rede), ícones, convite de instalação restrito ao staff — ver "PWA"
- [x] Cozinha em KANBAN (3 colunas simultâneas) + ALERTA SONORO de pedido novo (Web Audio,
      só em INSERT, debounce, mudo persistido), Wake Lock e indicador de conexão realtime
- [x] Garçom: card inteiro verde quando há item pronto para entregar (texto branco)
- [x] Produto "esgotado hoje" (migration 012): flag separado de `disponivel`; fica no cardápio
      riscado/bloqueado; toggle no admin; guarda na RPC `criar_item_pedido`
- [x] Máscara de moeda (R$) em todos os inputs de preço (`fmt.money/moneyMask/moneyParse`)
- [x] Garçom lança pedido pela tela de staff (migration 013): /garcom/nova-comanda + /garcom/pedido,
      RPC transacional `lancar_pedido_garcom` (reaproveita `criar_item_pedido`)
- [x] Prevenção de comanda-zumbi — Caso 1 (comanda vazia, migrations 014/015): job pg_cron expira
      comandas `aberta` sem itens > 30min + botão "Cancelar comanda vazia" (RPC `cancelar_comanda_vazia`)

## ⏳ Gaps conhecidos (roadmap)

### Antes de escalar (críticos)
- [ ] Integração NFC-e (Focus NFe, NFe.io)
- [ ] Impressora térmica na cozinha (ESC/POS)
- [x] ~~Som ao chegar pedido novo~~ — feito (hook `useCozinhaAlerta`; ver Cozinha)
- [ ] Cobrança recorrente (Asaas/Stripe)
- [ ] Onboarding self-service + landing page
- [ ] Testes E2E (Playwright)

### Operacional
- [ ] Ofertas valendo no pedido (RPC honrar em_oferta/oferta_preco no snapshot)
- [x] ~~Estoque básico (produto "esgotado hoje")~~ — feito (migration 012)
- [ ] Toggle de favorito/"Mais pedidos" na tela do garçom (deixado fora do v1 do lançamento manual)
- [ ] Comanda-zumbi Caso 2: comanda COM itens abandonada (lembrete/selo de ociosidade; perda/dine-and-dash);
      threshold de expiração configurável por restaurante (hoje é 30min global)
- [ ] Edição de pedido após enviar
- [ ] Divisão por itens (não só igual)
- [ ] Notificações Web Push pra garçom (sobre a PWA do staff)
- [ ] Modo offline com retry automático (hoje o SW é só shell estático; dados sempre da rede)

### SaaS / Crescimento
- [ ] White-label (logo + cores customizáveis)
- [ ] Subdomínio próprio por cliente
- [ ] Relatórios exportáveis (CSV/Excel)
- [ ] Auditoria (tabela auditoria com user_id + ação + antes/depois)
- [ ] Rate limiting nas rotas públicas (proteção contra bot)
- [ ] Sentry + UptimeRobot

---

## 🚫 O que NÃO fazer

- ❌ Não usar libs de componentes (shadcn, MUI, Chakra) — componentes customizados em Tailwind
- ❌ Não usar `pages router` — apenas App Router
- ❌ Não usar CSS modules — apenas Tailwind
- ❌ Não usar mock data — sempre Supabase real
- ❌ Não hardcodar chaves do Supabase
- ❌ Não usar a `service_role_key` no frontend
- ❌ Não criar tabela sem `restaurante_id` + RLS
- ❌ Não fazer INSERT sem incluir `restaurante_id`
- ❌ Não usar preto puro `#000` ou branco puro `#fff`
- ❌ Não usar gradientes complexos ou sombras excessivas
- ❌ Não alterar paleta ou tipografia sem autorização
- ❌ Não criar autenticação pra cliente final em `/mesa/[id]`
- ❌ Não esquecer `unsubscribe` em useEffect com Realtime
- ❌ Não esquecer guards de race condition em UPDATEs críticos (ex: cancelamento de item precisa de `WHERE status='novo'`)
- ❌ Não enviar preço de adicional/produto pelo client — só os IDs; o preço é snapshot no servidor
- ❌ Não inserir direto em `itens_pedido` no fluxo do cliente — usar SEMPRE a RPC `criar_item_pedido`
- ❌ Não lançar pedido do garçom inserindo na mão — usar a RPC `lancar_pedido_garcom` (`lib/lancarPedidoGarcom.ts`)
- ❌ Não usar `parseFloat` cru em input de dinheiro — usar `fmt.moneyMask` (onChange) e `fmt.moneyParse` (submit)
- ❌ Não confundir `esgotado` com `disponivel`: `disponivel=false` SOME do cardápio; `esgotado=true` fica visível riscado e bloqueado
- ❌ Não somar total de comanda na mão — usar `subtotalItem`/`totalComanda` de `lib/calcComanda.ts`
- ❌ Não **escopar por tenant a leitura do cardápio** (`produtos/categorias/mesas/restaurantes/…`) —
  o `/mesa/[id]` é público; escopar quebra o cliente logado em outro tenant ("Mesa indisponível").
  Só as **vendas** (`comandas/itens_pedido/itens_pedido_adicionais`) são escopadas na leitura.
- ❌ Não mandar `null` para coluna `NOT NULL DEFAULT …` no INSERT (ex.: `produtos.descricao`) — o
  default só vale quando a coluna é **omitida**; mandar `''`/o valor, não `null`.
- ❌ Não rodar SQL na mão no PRD — usar `migration new` → `db:reset` → `db:push` (histórico já reconciliado).
- ❌ Não esquecer de cadastrar `SUPABASE_SERVICE_ROLE_KEY` no Vercel (Production) — sem ela a criação de restaurante falha.
- ❌ Não montar o `InstallPrompt` (ou qualquer UI "app-like") no fluxo público do cliente
  (`/mesa`, `/privacidade`, `/login`) — só no staff, por baixo do `ProtectedRoute`.
- ❌ Não cachear dados de pedido/Supabase no service worker — sempre `NetworkOnly`/rede (sem cache agressivo).
- ❌ Não testar a PWA com `next dev` (serwist desligado em dev) nem por `http://<IP>` no celular
  (SW exige HTTPS/localhost) — usar `next build && next start` e a produção HTTPS / túnel.

---

## 🧭 Convenções de prompt

Quando o usuário pedir nova funcionalidade:

1. **Sempre confirmar impacto multi-tenant:** "Essa feature precisa de `restaurante_id`? RLS deve isolar?"
2. **Sempre seguir o padrão visual:** consultar a paleta, tipografia e regras de UX deste documento
3. **Sempre tratar 3 estados:** loading, vazio, erro
4. **Sempre incluir Realtime quando relevante:** itens_pedido, comandas
5. **Sempre validar no backend (RLS + check constraints):** não confiar só no frontend
6. **Sempre considerar mobile-first:** começar pelo layout 390px

---

## 📞 Contexto comercial

- **Cliente piloto:** 637 Cerveja Artesanal (cervejaria + beach tennis)
- **Founder:** Victor (Optmore)
- **WhatsApp comercial:** (11) 91732-0202
- **Preço:** R$ 199/mês, sem fidelidade
- **Custo mensal de infra:** ~R$ 144 (Supabase Pro + domínio)
- **Margem por cliente após o 1º:** 90%+

---

**Última atualização:** Junho de 2026 — cozinha em kanban + alerta sonoro/Wake Lock/indicador de
conexão (hook `useCozinhaAlerta`); garçom card verde quando há item pronto; produto "esgotado hoje"
(migration 012); máscara de moeda nos inputs de preço; garçom lança pedido pela tela de staff
(migration 013, RPC `lancar_pedido_garcom`); prevenção de comanda-zumbi Caso 1 (migrations 014/015:
job pg_cron + `cancelar_comanda_vazia`). Migrations 001–007 arquivadas.
**Versão do produto:** 0.5.0 — MVP em produção (mesa fixa + adicionais + esgotado + lançamento garçom + anti comanda-zumbi)
