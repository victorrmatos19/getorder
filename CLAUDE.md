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
| QR Code | qrcode.react |
| Gráficos | recharts |
| Fontes | Cormorant Garamond + Work Sans (via next/font/google) |

**Estrutura de pastas:**

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── login/
│   ├── mesa/[id]/              ← rota pública (cliente)
│   ├── cozinha/                ← protegida (cozinha/admin)
│   ├── garcom/                 ← protegida (garcom/admin)
│   │   └── comanda/[id]/
│   ├── admin/                  ← protegida (admin)
│   │   ├── cardapio/
│   │   ├── mesas/
│   │   └── configuracoes/
│   ├── super-admin/            ← protegida (super_admin)
│   └── privacidade/            ← política LGPD pública
├── components/
│   ├── Logo.tsx
│   ├── PageHeader.tsx
│   ├── ProductCard.tsx
│   ├── ProductStepper.tsx
│   ├── StatusBadge.tsx
│   ├── EmptyState.tsx
│   ├── ProtectedRoute.tsx
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
│   │   └── useRestaurante.ts
│   └── formatters.ts
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
  descricao text,
  preco numeric(10,2),
  oferta_preco numeric(10,2),
  em_oferta boolean,
  novidade boolean,
  destaque_ordem integer DEFAULT 999,
  disponivel boolean,
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
  status text CHECK ('aberta','fechada'),
  forma_pagamento text CHECK ('pix','debito','credito','dinheiro'),
  total numeric(10,2),
  numero_pessoas integer DEFAULT 1,
  taxa_servico_valor numeric(10,2),
  taxa_servico_aplicada boolean DEFAULT true,
  aceite_lgpd_em timestamptz,
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
  cancelado_em timestamptz,
  cancelado_por uuid references auth.users(id),
  criado_em timestamptz
)
```

### RLS — Row Level Security

**Funções helper:**

```sql
auth_restaurante_id()  -- retorna restaurante_id do usuário logado
is_super_admin()       -- retorna true se role = 'super_admin'
```

**Policies principais:**
- `tenant_isolation`: usuário só vê dados do próprio restaurante (super_admin vê tudo)
- `public_read_produtos`: leitura pública de produtos disponíveis (rota /mesa)
- `public_read_categorias`: idem categorias
- `public_read_mesas`: idem mesas ativas
- `public_insert_comandas`: clientes anônimos podem inserir comandas
- `public_insert_itens`: idem itens_pedido
- `public_read_comandas` / `public_read_itens`: leitura para acompanhamento da comanda do cliente

⚠️ **CRÍTICO:** Toda nova tabela com dados de restaurante DEVE incluir:
1. Coluna `restaurante_id uuid NOT NULL REFERENCES restaurantes(id)`
2. Índice em `restaurante_id`
3. `ENABLE ROW LEVEL SECURITY`
4. Policy `tenant_isolation` usando as funções helper

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
| `/garcom`, `/garcom/comanda/[id]` | admin, garcom |
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
5. Pedido:
   - Stepper +/- com observação livre opcional (até 200 chars)
   - INSERT em itens_pedido (status 'novo', incluindo restaurante_id)
6. Aba "Minha Comanda":
   - Itens agrupados por rodada (≤2min entre criados)
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
2. 3 abas: Novos | Preparando | Prontos
3. Query: itens_pedido JOIN produtos JOIN comandas JOIN mesas
   WHERE status IN ('novo','em_preparo','pronto')
4. Cards mostram: mesa/quadra, nome cliente, itens com OBSERVAÇÃO em destaque
5. Tempo > 15min → cor de urgência
6. Botões transitam status:
   novo → em_preparo → pronto → entregue (some)
7. Realtime ativo
```

**⚠️ Observações em destaque:** na cozinha, o campo `obs` (e os adicionais escolhidos) deve ser exibido em peso 700, cor --accent. Operador NÃO pode perder isso.

### 3. Garçom (/garcom)

```
1. Lista mesas com comandas abertas
2. Agrupado por mesa, mostrando todas as comandas se múltiplas:
   - Quadra 2 (2 comandas)
     · Ana Paula · R$ 96,00
     · Rafael M. · R$ 54,00
3. Badge de urgência se algum item está 'pronto'
4. Card amarelo se tem entrega pendente, verde se ok
```

### 4. Comanda detalhada (/garcom/comanda/[id])

```
1. Header: mesa como identidade (+ nome e CPF parcial apenas em comandas legadas)
2. Histórico agrupado por rodada
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
- /admin                   → Dashboard: faturamento dia, pedidos, produto top, mesa top, gráfico por hora
- /admin/cardapio          → CRUD produtos + categorias, toggle disponível, upload de foto
- /admin/mesas             → CRUD mesas, gerar QR Code com qrcode.react
- /admin/configuracoes     → Taxa, horário, pausa de pedidos
```

### 6. Super Admin (/super-admin)

```
- /super-admin                        → Lista restaurantes
- /super-admin/restaurantes/novo      → Cria restaurante + 1º usuário admin
- /super-admin/restaurantes/[id]      → Edita, lista usuários, ativa/desativa
```

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

## 🚀 Deploy e ambiente

### Produção
- **Frontend:** Vercel (auto-deploy via `git push` na branch `main`)
- **Backend:** Supabase Pro (backup diário automático)
- **DNS:** Registro.br → `getorder.com.br` (apontando para Vercel)

### Variáveis de ambiente

`.env.local` (desenvolvimento) e Vercel Environment Variables (produção):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

⚠️ **NUNCA** commitar `.env.local`. Sempre usar `NEXT_PUBLIC_` no prefix das vars que vão pro client.
⚠️ **NUNCA** usar `SUPABASE_SERVICE_ROLE_KEY` no frontend. Bypassa RLS.

### Supabase Auth Configuration
- Site URL: `https://getorder.com.br` (ou domínio Vercel)
- Redirect URLs: `https://getorder.com.br/**` e `https://*.vercel.app/**`

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
fmt.currency(v)   // R$ 18,00
fmt.cpf(v)        // 123.456.789-00
fmt.cpfMask(v)    // máscara dinâmica em input
fmt.time(v)       // 19h32
fmt.elapsed(v)    // 12min, 1h05min
```

---

## ✅ Funcionalidades implementadas

- [x] Multi-tenant com RLS
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

## ⏳ Gaps conhecidos (roadmap)

### Antes de escalar (críticos)
- [ ] Integração NFC-e (Focus NFe, NFe.io)
- [ ] Impressora térmica na cozinha (ESC/POS)
- [ ] Som ao chegar pedido novo
- [ ] Cobrança recorrente (Asaas/Stripe)
- [ ] Onboarding self-service + landing page
- [ ] Testes E2E (Playwright)

### Operacional
- [ ] Modificadores estruturados (extras pagos)
- [ ] Estoque básico (produto "esgotado hoje")
- [ ] Edição de pedido após enviar
- [ ] Divisão por itens (não só igual)
- [ ] Notificações Web Push pra garçom
- [ ] Modo offline com retry automático

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

**Última atualização:** Junho de 2026
**Versão do produto:** 0.2.0 — MVP em produção (modo mesa fixa: comanda direto na mesa)
