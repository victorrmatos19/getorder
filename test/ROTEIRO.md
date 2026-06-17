# ROTEIRO DE QA — GetOrder

> Roteiro de testes de fluxo do sistema, pensado para ser executado **manualmente** ou por uma
> **skill de QA** que dirige o app local via navegador (snapshots/cliques/eval).
> Cobre as **15 rotas** do sistema. Não é Playwright — é um roteiro estruturado.
>
> Convenção de marcação por suite: **[A]** = automatizável só com leitura/cliques no browser ·
> **[D]** = precisa de dado/efeito no banco (verificar no Studio/psql ou em outra tela).

---

## 0. Setup / pré-condições (ambiente LOCAL — nunca o PRD)

Rodar tudo contra o Supabase local (Docker) para ter dados **determinísticos**.

```bash
npm run db:start                 # sobe o stack local (Docker)
npm run db:reset                 # recria o schema (baseline) + recarrega o seed (snapshot do PRD)
# Definir senhas de teste APÓS o reset (o reset recarrega os hashes do PRD):
docker exec supabase_db_getorder psql -U postgres -d postgres -c "update auth.users set encrypted_password = crypt('teste1234', gen_salt('bf')) where email in ('637@admin.com','637@cozinha.com','637@garcom.com');"
npm run dev                      # app em http://localhost:3000  (usa .env.local → local)
```

> ⚠️ Confirme que `.env.local` aponta para o **local** (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`).
> O backup do PRD fica em `.env.prd.local`.

### Contas de teste
| Papel | Email | Senha |
|---|---|---|
| admin | `637@admin.com` | `teste1234` |
| cozinha | `637@cozinha.com` | `teste1234` |
| garçom | `637@garcom.com` | `teste1234` |
| super_admin | `victor.rodrigues.dmatos@gmail.com` | (senha própria do PRD) |

### Como obter um `mesa_id` (estável entre resets)
```bash
docker exec supabase_db_getorder psql -U postgres -d postgres -t -A -F"|" -c "select id, nome from mesas where ativo order by nome;"
```
Ex.: **Mesa 1**, Mesa 2, Mesa 3, Quadra 1…. Use o `id` (UUID) na URL `/mesa/<id>`.

### Dicas de automação (aprendidas dirigindo o app)
- **Cliente é mobile-first** → use viewport **390×844** (ou preset mobile). Staff/admin: tablet/desktop ok.
- **Botões têm emoji no texto** (ex.: `🍔Lanches`, `📱PIX`, `🔥Em Oferta`). Para clicar por texto,
  **use `includes()` e não igualdade exata**:
  `[...document.querySelectorAll('button')].find(b => b.textContent.includes('Lanches')).click()`
- **Esperar** ~1–2,5s após navegação, envio de pedido, login (queries assíncronas + realtime).
- **Login**: preencher `input[type=email]` e `input[type=password]`, clicar `button[type=submit]`.
- **Console**: ao final de cada suite, ler os logs do console (erros + warnings) — registrar qualquer um.
- **Sanidade do caminho público**: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/mesa/<id>`
  deve dar **200** (sem redirect para /login).
- Estado limpo: rode `db:reset` (e redefina as senhas) antes de uma bateria completa.

### Asserções: prefira **invariantes** a valores fixos
Os valores em R$ dependem do seed (podem mudar). Asserte comportamento:
- `Total da comanda (cliente) = Subtotal + Taxa de serviço`
- `Total do checkout (garçom) == Total da Minha Comanda (cliente)` para a mesma comanda (taxa aplicada, 1 pessoa)
- `Total do garçom (lista) inclui adicionais` (≠ só quantidade × preço base)

---

## Suite 1 — Acesso & permissões (login / middleware / roles) · [A]
**Objetivo:** garantir o controle de acesso por papel.
1. Abrir `/` → **redireciona para `/login`**.
2. Logar como **admin** → vai para `/admin`. Logout (botão "Sair").
3. Logar como **cozinha** → vai para `/cozinha`. Como **garçom** → `/garcom`. Como **super_admin** → `/super-admin`.
4. Logado como **cozinha**, abrir `/garcom` → redireciona para **`/login?forbidden=1`**.
5. Sem login, abrir `/admin` → redireciona para `/login`.
6. Sem login, abrir `/mesa/<id>` → **carrega normal (HTTP 200, sem redirect)** — rota pública.

**Esperado:** cada papel só acessa suas rotas; rota pública não exige auth.

---

## Suite 2 — Cliente: abertura + cardápio (`/mesa/[id]`) · [A] ✅
**Objetivo:** abertura direta na mesa (sem identificação) e cardápio.
1. Abrir `/mesa/<id de mesa ativa>` (viewport mobile).
2. Conferir: **sem tela de nome/CPF**; cai direto no cardápio. Header mostra o nome da mesa + logo GetOrder + "Sair".
3. Abas **Cardápio / Minha Comanda**; pílulas de categoria (e seções 🆕 Novidades / 🔥 Em Oferta se houver).
4. Trocar de categoria (clicar "Lanches", "Drinks"…) → lista muda.
5. Abrir `/mesa/<uuid-invalido>` → **"Mesa indisponível"**.
6. (Compartilhada) Abrir a MESMA `/mesa/<id>` em 2 abas → ambas na mesma comanda (mesmos itens em "Minha Comanda").

**Esperado:** cardápio carrega; cards "tap-to-open" (clicáveis, com chevron); produtos com foto/nome/preço/descrição.

---

## Suite 3 — Cliente: detalhe do produto + adicionais · [A] ✅
**Objetivo:** tela de detalhe (padrão único) com validação de grupos.
1. Em "Lanches", abrir um produto **com adicionais** (ex.: *Burger Artesanal*).
2. Conferir tela cheia: foto, nome, preço base, descrição.
3. Grupo **obrigatório** (ex.: "Ponto da Carne") mostra selo "Obrigatório" + hint **"Selecione uma opção"**;
   o botão inferior fica **desabilitado** ("Selecione as opções obrigatórias").
4. Seleção **única** = radio (uma escolha). Selecionar uma opção → botão habilita: **"Adicionar ao pedido · R$ X"**.
5. Se houver grupo **múltipla**: marcar várias (checkbox), **bloquear acima do máximo** (opções não marcadas desabilitam ao atingir o teto). Opção paga mostra **"+ R$ X"**; opção grátis não mostra preço.
6. Preencher **observação** (≤200) e **quantidade** (stepper). O **total do botão recalcula ao vivo** (base + adicionais) × qtd.
7. Voltar ao cardápio; abrir um produto **sem adicionais** (ex.: uma cerveja) → mesma tela, só observação + quantidade, botão já habilitado.

**Esperado:** validação espelha a RPC; preço ao vivo correto; padrão único para todos os produtos.

---

## Suite 4 — Cliente: carrinho + envio · [A]/[D] ✅
**Objetivo:** carrinho de itens configurados e envio em lote (RPC).
1. Adicionar ao pedido um item **com** adicionais e outro **sem**. Barra inferior mostra **"N itens · Ver pedido · R$ Total"**.
2. Adicionar o **mesmo produto 2×** com configs diferentes (ex.: ponto diferente) → viram **2 linhas** no carrinho.
3. "Ver pedido" → modal **"Seu pedido"**: cada linha com nome × qtd, **adicionais** (+ preço quando >0), observação e subtotal.
4. **Remover** uma linha (✕). Remover todas → o modal fecha sozinho e a barra some.
5. "Enviar pedido" → cria os itens via RPC `criar_item_pedido`; **carrinho limpa**; toast "Pedido enviado!".
6. **[D]** Verificar em "Minha Comanda" (ou Studio) que os itens entraram com os adicionais.

**Esperado:** o total do carrinho == soma em "Minha Comanda" (mesmo helper `calcComanda`). Falha parcial de envio mantém as linhas não enviadas (testável forçando indisponibilidade — ver Suite 6).

---

## Suite 5 — Cliente: Minha Comanda · [A] ✅
**Objetivo:** acompanhamento, total com taxa e cancelamento.
1. Aba **"Minha Comanda"**: itens agrupados por **rodada** (≤2min), com **adicionais sob cada item**.
2. Itens recém-enviados aparecem como **"Aguardando Preparo"**.
3. Rodapé: **Subtotal**, **Taxa de serviço (X%)**, **Total** (= Subtotal + Taxa). Anotar o Total (usar na Suite 8).
4. **Cancelar** um item com status 'novo' (✕ → confirmar) → vira "Cancelado" e sai do total. Item já "Preparando" **não** cancela ("Já estava em preparo").
5. "Solicitar conta" → toast. "Sair" → tela "Você saiu da comanda"; "Voltar ao cardápio" reabre a mesma comanda.

**Esperado:** total com taxa correto; guard de cancelamento; status reflete a cozinha (realtime).

---

## Suite 6 — Pausa de pedidos / fora de horário · [A]/[D]
**Objetivo:** bloqueio de novos pedidos.
1. Como **admin**, em `/admin/configuracoes` (aba Geral), **ativar "Pausar novos pedidos"** + mensagem; salvar.
2. No cliente (`/mesa/<id>`), recarregar → **banner "Pedidos pausados"** com a mensagem; o botão "Enviar pedido" e o "Adicionar ao pedido" ficam **desabilitados**.
3. Desativar a pausa no admin → cliente volta a pedir.
4. (Horário) Em `/admin/configuracoes` (aba Horário), marcar o **dia atual como "Fechado"** → cliente vê **banner "fora de horário"** e não envia. Reverter.

**Esperado:** o gatilho de horário/pausa bloqueia também via RPC (defesa no servidor).

---

## Suite 7 — Cozinha (`/cozinha`) · [A] ✅
**Objetivo:** painel da cozinha e transições de status.
1. Logar como **cozinha**. Tema escuro; header com **relógio rodando** (segundos) + "Cozinha · GetOrder".
2. 3 abas **Novos / Preparando / Prontos** com contadores.
3. Card por mesa com os itens; **adicionais em destaque terracota** no formato `GRUPO: OPÇÃO` (ex.: "PONTO DA CARNE: AO PONTO") e a **observação** também destacada (peso 700).
4. "Iniciar Preparo" (novo→em_preparo) → some de "Novos", aparece em "Preparando". Depois "Marcar Pronto" e "Confirmar Entrega" (some).
5. **Realtime:** com a cozinha aberta, enviar um pedido pelo cliente em outra aba → o card **aparece sem reload**.
6. (Urgência) Item com >15min mostra cor/realce de urgência.

**Esperado:** adicionais/obs nunca se perdem visualmente; transições e realtime ok; relógio não trava o grid.

---

## Suite 8 — Garçom + comanda/checkout (`/garcom`, `/garcom/comanda/[id]`) · [A] ✅
**Objetivo:** lista de mesas, comanda detalhada e fechamento.
1. Logar como **garçom** (ou admin). Lista de mesas com comandas abertas; cada comanda mostra **total** e contagem de itens.
2. **Asserção-chave:** o total da comanda na lista **inclui adicionais** e **bate** com o Subtotal da "Minha Comanda" do cliente (mesma comanda).
3. Badge "prontos" quando há item pronto.
4. Abrir a comanda (`/garcom/comanda/[id]`): histórico por **rodada** com adicionais e subtotal por item; status reflete a cozinha (realtime).
5. "Entregar" item/todos (quando há prontos); "Cancelar" item 'novo'.
6. **"Encerrar e Cobrar"**: modal mostra **Total = Subtotal + Taxa** e o resumo com adicionais.
   - **Asserção-chave:** esse Total **é igual** ao Total da "Minha Comanda" do cliente (Suite 5, taxa aplicada, 1 pessoa).
   - Toggle de **taxa** (se não obrigatória), **stepper de pessoas** (valor por pessoa), **formas de pagamento**.
   - **PIX é apenas seleção — NÃO há QR Code nem "Chave PIX".** Dinheiro → campo "Valor recebido" + troco.
7. Selecionar uma forma e **Confirmar** → tela "Comanda encerrada / R$ X recebido via <forma>"; itens viram "Entregue"; a comanda **some da lista** do garçom.

**Esperado:** paridade de total cliente↔garçom; PIX sem QR; fechamento atualiza status e dashboard.

---

## Suite 9 — Admin: dashboard (`/admin`) · [A] ✅
**Objetivo:** métricas do dia.
1. Logar como **admin**. Cards: **Faturamento hoje, Pedidos hoje, Produto top, Mesa top** (refletem comandas fechadas/itens do dia).
2. **"Vendas por hora"** — o **gráfico (recharts) carrega sob demanda** (lazy via `next/dynamic`) e renderiza barras.
3. "Últimos pedidos" lista itens recentes com status.
4. Após fechar uma comanda (Suite 8), o **Faturamento** reflete o valor.

**Esperado:** dashboard sem erro; gráfico renderiza (`.recharts-wrapper` presente).

---

## Suite 10 — Admin: cardápio (`/admin/cardapio`) · [A]/[D]
**Objetivo:** CRUD de produtos e categorias + vínculo de adicionais.
1. Aba **Produtos**: **Criar** produto (nome, preço, categoria, disponível; foto opcional) → aparece na categoria.
2. **Editar** produto; toggles rápidos **Disponível / Novidade / Oferta** (oferta pede preço promocional < preço).
3. **Excluir** produto (confirmar).
4. Aba **Categorias**: criar/editar (emoji, nome, ordem, ativa), **reordenar** (▲▼), **excluir** — bloqueia se houver produtos vinculados.
5. No **editor de um produto salvo**: seção **"Adicionais e opções"** → marcar grupos (vincula), definir **ordem**, ver **preview** "Este produto terá: …". Em produto **novo**, a seção pede **salvar primeiro**.

**Esperado:** persiste no banco (recarregar mantém); vínculos refletem no detalhe do cliente.

---

## Suite 11 — Admin: adicionais (`/admin/cardapio/adicionais`) · [A]/[D] ✅(parcial)
**Objetivo:** CRUD de grupos reutilizáveis e opções.
1. Acessar via aba **"Adicionais"** no cardápio (link no topo).
2. Cards de grupo com **regra em linguagem natural** (ex.: "Escolha única · obrigatório", "Múltipla · até 3 · opcional"), opções com **preço** ou **"grátis"**, e **toggle Ativo**.
3. **+ Novo grupo** → criar **"Ponto da carne"**: seleção **única**, **obrigatório**, 3 opções (Mal/Ao Ponto/Bem) preço 0. Conferir que **min/max ficam escondidos** quando única.
4. Criar **"Adicionais"**: seleção **múltipla**, definir máximo (ex.: até 3), opções **com preço** (Bacon, Cheddar…). Conferir que **min/max aparecem** quando múltipla.
5. **Editar** grupo (add/edit/remove opção; preço/disponível). **Toggle ativo/inativo**.
6. **Excluir** grupo → diálogo avisa **"será removido de N produtos"**.

**Esperado:** grupos/opções persistem; regras refletem na tela de detalhe do cliente (Suite 3).

---

## Suite 12 — Admin: mesas (`/admin/mesas`) · [A]
**Objetivo:** CRUD de mesas e QR Code.
1. **Criar/editar/ativar-desativar** mesa.
2. Botão **"QR"** → modal com o QR da URL `/mesa/<id>` (nome da mesa + QR + URL).
3. **Imprimir** (Ctrl+P / preview de impressão) → a folha mostra **apenas o nome da mesa + o QR grande e centralizado** (sem subtítulo "637 cervejaria"/URL/botões, sem moldura do modal), cabendo em **1 página**.

**Esperado:** QR aponta para a mesa certa; impressão limpa (correção da impressão).

---

## Suite 13 — Admin: configurações (`/admin/configuracoes`) · [A]/[D]
**Objetivo:** taxa, pausa e horários.
1. Aba **Geral**: alterar **percentual da taxa** e o flag **"Obrigatória"**; salvar. (Reflete no checkout/Minha Comanda — Suites 5/8.)
2. **Pausar pedidos** + mensagem (testado na Suite 6).
3. Aba **Horário**: editar `abre`/`fecha` por dia da semana e marcar **"Fechado"**; salvar (reflete na disponibilidade do cliente).

**Esperado:** mudanças persistem e afetam cliente/checkout.

---

## Suite 14 — Super-admin (`/super-admin`) · [A]/[D]
**Objetivo:** gestão multi-tenant.
1. Logar como **super_admin**. Lista de restaurantes.
2. **Criar restaurante + 1º usuário admin** (`/super-admin/restaurantes/novo`) — usa a rota API com `service_role`.
3. **Editar / ativar-desativar** restaurante (`/super-admin/restaurantes/[id]`); listar usuários.
4. (Multi-tenant) Logar com o **novo admin** → vê só o **próprio** restaurante (isolamento RLS: não enxerga produtos/comandas do 637).

**Esperado:** criação funciona; isolamento por `restaurante_id` (RLS) garantido.

---

## Suite 15 — LGPD / privacidade (`/privacidade`) · [A]
1. Abrir `/privacidade` (público) → página de política carrega.

---

## Anexo A — Mapa de rotas
| Rota | Acesso | Função |
|---|---|---|
| `/` | público | redireciona → `/login` |
| `/login` | público | login da equipe |
| `/privacidade` | público | política LGPD |
| `/mesa/[id]` | público (cliente) | abertura na mesa + cardápio + pedido + Minha Comanda |
| `/cozinha` | admin, cozinha | painel de pedidos (status) |
| `/garcom` | admin, garçom | lista de mesas/comandas abertas |
| `/garcom/comanda/[id]` | admin, garçom | comanda detalhada + checkout |
| `/admin` | admin | dashboard |
| `/admin/cardapio` | admin | produtos + categorias |
| `/admin/cardapio/adicionais` | admin | grupos de adicionais |
| `/admin/mesas` | admin | mesas + QR |
| `/admin/configuracoes` | admin | taxa, horário, pausa |
| `/super-admin` | super_admin | lista de restaurantes |
| `/super-admin/restaurantes/novo` | super_admin | criar restaurante + admin |
| `/super-admin/restaurantes/[id]` | super_admin | editar/usuários/ativar |

## Anexo B — Checklist de regressão (otimizações de performance)
- `/mesa/<id>` → `curl` retorna **200 sem redirect** (middleware não roda em rota pública).
- Cozinha: os cards **não** re-renderizam a cada 1s (só o relógio atualiza).
- `/admin`: o gráfico (recharts) entra como **chunk separado** (lazy) — First Load do `/admin` enxuto.
- Cozinha/Garçom: queries trazem só as colunas usadas (sem `produto(*)`/`comanda(*)`), UI idêntica.

## Anexo C — Como registrar resultados
Para cada suite: **PASS/FAIL**, evidência (screenshot/snapshot), e **logs de console** (erros/warnings).
Em FAIL, anotar rota, passo, esperado × obtido e qualquer erro de console/rede.
