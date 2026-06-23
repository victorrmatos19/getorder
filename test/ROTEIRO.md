# ROTEIRO DE QA — GetOrder

> Roteiro de testes de fluxo do sistema, pensado para ser executado **manualmente** ou por uma
> **skill de QA** que dirige o app local via navegador (snapshots/cliques/eval).
> Cobre as **17 rotas** do sistema. Não é Playwright — é um roteiro estruturado.
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
8. **Produto esgotado** (marque um como "Esgotado" no admin — Suite 10): no cardápio ele **continua aparecendo** com badge vermelho **"Esgotado"**, nome/preço **riscados** e card esmaecido; ao abrir o detalhe, o botão fica **desabilitado** ("Produto esgotado") e não adiciona ao carrinho. *(esgotado ≠ indisponível: indisponível SOME do cardápio.)*

**Esperado:** validação espelha a RPC; preço ao vivo correto; padrão único para todos os produtos; esgotado visível porém bloqueado (defesa também na RPC: `'Produto esgotado'`).

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
**Objetivo:** painel da cozinha (kanban), alerta sonoro, transições de status e robustez.
1. Logar como **cozinha**. Tema escuro; header com **relógio rodando** (segundos) + "Cozinha · GetOrder".
2. **KANBAN — as 3 colunas Novos / Preparando / Prontos aparecem AO MESMO TEMPO** (cada uma com
   scroll próprio), **não são mais abas** que trocam. Cada coluna tem cabeçalho com a cor do status + contador.
3. Card por mesa com os itens; **adicionais em destaque terracota** no formato `GRUPO: OPÇÃO` (ex.: "PONTO DA CARNE: AO PONTO") e a **observação** também destacada (peso 700).
4. "Iniciar Preparo" (novo→em_preparo) → o card **move para a coluna "Preparando"**. Depois "Marcar Pronto" e "Confirmar Entrega" (some).
5. **Realtime:** com a cozinha aberta, enviar um pedido pelo cliente em outra aba → o card **aparece sem reload**.
6. (Urgência) Item com >15min mostra cor/realce de urgência.
7. **Alerta sonoro:** no header há **"🔔 Ativar som"** (gesto necessário p/ liberar o autoplay; ou
   o 1º toque na tela arma). Depois vira toggle **🔔/🔕** (mudo persiste em `localStorage`).
   - Enviar um pedido novo pelo cliente → **toca um chime** (só em **INSERT** de item novo); vários
     itens do mesmo pedido = **um** toque (debounce). **Mover** card (UPDATE) e **recarregar** a
     página **não** tocam. Mudo ligado → não toca.
8. **Indicador de conexão realtime** no header: **🟢 Ao vivo** (conectado), 🟠 Reconectando, 🔴 Sem conexão.
9. **Wake Lock:** a tela não deve "dormir" com a cozinha aberta (degrada sem erro onde não há suporte).

**Esperado:** 3 colunas simultâneas; adicionais/obs nunca se perdem; som só em pedido novo; transições e realtime ok; relógio não trava o grid.

---

## Suite 8 — Garçom + comanda/checkout (`/garcom`, `/garcom/comanda/[id]`) · [A] ✅
**Objetivo:** lista de mesas, comanda detalhada e fechamento.
1. Logar como **garçom** (ou admin). Lista de mesas com comandas abertas; cada comanda mostra **total** e contagem de itens. Header tem o botão **"Nova comanda"** (→ lançamento manual, Suite 17).
2. **Asserção-chave:** o total da comanda na lista **inclui adicionais** e **bate** com o Subtotal da "Minha Comanda" do cliente (mesma comanda).
3. **Card INTEIRO VERDE (texto branco)** quando a mesa tem item **'pronto'** para entregar (chamativo), com badge "N prontos"; visual **neutro creme** quando não há nada pronto.
4. Abrir a comanda (`/garcom/comanda/[id]`): histórico por **rodada** com adicionais e subtotal por item; status reflete a cozinha (realtime). Rodapé tem **"Novo pedido"** (→ Suite 17).
5. "Entregar" item/todos (quando há prontos); "Cancelar" item 'novo'.
6. **"Encerrar e Cobrar"**: modal mostra **Total = Subtotal + Taxa** e o resumo com adicionais.
   - **Asserção-chave:** esse Total **é igual** ao Total da "Minha Comanda" do cliente (Suite 5, taxa aplicada, 1 pessoa).
   - Toggle de **taxa** (se não obrigatória), **stepper de pessoas** (valor por pessoa), **formas de pagamento**.
   - **PIX é apenas seleção — NÃO há QR Code nem "Chave PIX".** Dinheiro → campo **"Valor recebido"** (com **máscara de moeda** em centavos) + troco automático.
7. Selecionar uma forma e **Confirmar** → tela "Comanda encerrada / R$ X recebido via <forma>"; itens viram "Entregue"; a comanda **some da lista** do garçom.

**Esperado:** paridade de total cliente↔garçom; PIX sem QR; fechamento atualiza status e dashboard.

---

## Suite 9 — Admin: dashboard v2 (`/admin`) · [A]/[D] ✅
**Objetivo:** dashboard **gerencial** — período, comparação Δ% e blocos. Financeiro só de comandas
`fechada` (ignora `aberta`/`cancelada`); tudo por `restaurante_id`.
1. Logar como **admin**. Topo: bloco **"Ao vivo · hoje"** (faturamento de hoje + comandas abertas)
   — **realtime** (enviar/fechar pedido em outra aba atualiza sem reload).
2. **Seletor de período**: **Hoje · 7 dias · Mês · Personalizado** (com inputs de data). Trocar o
   período **recalcula todos os blocos**.
3. **Resumo** (4 cards): Faturamento, Ticket médio, Comandas, Pessoas — cada um com **Δ% vs período
   anterior** (▲ verde / ▼ vermelho; "—" quando não há base).
4. **Tendência de faturamento** (Recharts area, lazy via `next/dynamic`): por **dia** (ou por **hora**
   no período "Hoje").
5. **Desempenho de produtos**: ranking com toggle **Receita/Volume**, barras, seção **"menos
   vendidos"** (cauda) e **adicionais mais pedidos**.
   - **[D] Asserção:** o ranking **bate com a soma real dos snapshots** (conferir 1 produto via SQL:
     `sum(preco_base_snapshot*quantidade)` das comandas fechadas do período).
6. **Mix operacional**: formas de pagamento (nº de comandas + Σ valor + %), **taxa captada**, **%
   de comandas com taxa**, **pessoas/comanda**.
7. **Pico — dia × hora**: heatmap (grade) dia-da-semana × hora (intensidade = nº de itens por `criado_em`).
8. **Qualidade / giro**: **tempo médio de mesa** (`fechado_em − criado_em`), **itens cancelados**,
   **comandas canceladas** separando `expiracao_automatica` × `cancelada_garcom`.
9. **Exportar** (botão no header) → baixa **CSV do período**: 1 linha por comanda fechada (data,
   hora, mesa, total, taxa, pagamento, pessoas, tempo de mesa). **[D] Asserção:** totais do CSV
   batem com a tela.
10. **[D] Asserção:** o **Faturamento** do período = `Σ total` das comandas `fechada` no intervalo
    (conferir via SQL); `cancelada`/`aberta` não entram.

**Esperado:** trocar período recalcula tudo; Δ% correto vs anterior de mesma duração; números batem
com o banco; gráficos renderizam; export gera arquivo coerente.

---

## Suite 10 — Admin: cardápio (`/admin/cardapio`) · [A]/[D]
**Objetivo:** CRUD de produtos e categorias + vínculo de adicionais.
1. Aba **Produtos**: **Criar** produto (nome, preço, categoria, disponível; foto opcional) → aparece na categoria.
   - **Máscara de moeda (R$):** os campos de **preço** e **preço promocional** auto-formatam em
     centavos ao digitar (digitar `1850` vira `18,50`; `185000` vira `1.850,00`). Salvar e **reabrir**
     → o valor inicial volta formatado.
2. **Editar** produto; toggles rápidos **Disponível / Esgotado / Novidade / Oferta** (oferta pede
   preço promocional < preço). O toggle **"Esgotado"** (também checkbox "Esgotado (sem estoque hoje)"
   no formulário) deixa o produto **riscado/bloqueado** no cliente sem tirá-lo do cardápio (Suite 3).
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
4. Criar **"Adicionais"**: seleção **múltipla**, definir máximo (ex.: até 3), opções **com preço** (Bacon, Cheddar…). Conferir que **min/max aparecem** quando múltipla. O campo de **preço da opção** usa **máscara de moeda** (centavos); opção sem preço = **grátis** (0).
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

## Suite 16 — Onboarding de restaurante NOVO (isolamento multi-tenant ponta-a-ponta) · [A]/[D]
**Objetivo:** validar que um restaurante **recém-criado** consegue cadastrar tudo e atender o
cliente — sem ver/gravar dados de outro tenant. Cobre a classe de bugs "só aparece no 2º restaurante"
(escrita barrada por RLS, leitura cruzada, "Mesa indisponível", upload de foto, save de configs).

> **Pré-condições extras:** após o `db:reset`, defina também a senha do super-admin localmente para
> poder criar o restaurante pela UI:
> `docker exec supabase_db_getorder psql -U postgres -d postgres -c "update auth.users set encrypted_password = crypt('teste1234', gen_salt('bf')) where email='victor.rodrigues.dmatos@gmail.com';"`

**Passos**
1. **Super-admin cria o restaurante novo** (`/super-admin/restaurantes/novo`): nome `Vyna Gelatos`,
   email `vyna@admin.com`, senha `teste1234` (≥8). Slug auto = `vyna-gelatos`. → "Restaurante criado".
   *(usa `service_role`; o trigger `force_tenant_on_write` **pula** — categorias padrão **e
   horários padrão (7 dias abertos)** são criados, então o restaurante já nasce "aberto".)*
2. **Logout** e **login limpo** como `vyna@admin.com`/`teste1234` → cai em `/admin`.
3. **Categoria** (`/admin/cardapio` → Categorias → `+ Nova`): criar `🍨 Sorvetes` → "Categoria salva".
4. **Produto + FOTO** (Produtos → `+ Novo`): nome, preço, categoria `Sorvetes`, **escolher uma foto**
   → Salvar. **Esperado:** `POST /storage/v1/object/produtos/... → 200` **e** `POST /rest/v1/produtos
   → 201`. *(Sem a policy de storage e o `descricao` correto, falhava — ver Anexo D.)*
5. **Adicional** (`/admin/cardapio/adicionais` → `+ Novo grupo`): grupo `Cobertura` (Múltipla) +
   opção `Granulado` `R$ 2,00` → "Grupo salvo".
6. **Mesa + QR** (`/admin/mesas` → `+ Nova`): `Mesa 10` → "Mesa salva"; abrir **QR** → a URL contém
   `/mesa/<uuid>`. Anote esse `mesa_id`.
7. **Configurações** (`/admin/configuracoes` → Geral): alterar **taxa** (ou marcar "Obrigatória") e
   **Salvar**. **[D] Esperado:** o valor **persiste** no banco
   (`select taxa_servico_percentual, taxa_servico_obrigatoria from restaurantes where slug='vyna-gelatos';`).
   *(Antes da migration 011 o PATCH dava 204 mas gravava 0 linhas — ver Anexo D.)*
   - **Horário:** o restaurante já vem com 7 dias abertos (criados no passo 1). Para testar o
     fechamento, marque um dia como **Fechado** e confira que o cliente vê "Fora do horário".
8. **CLIENTE em janela ANÔNIMA/DESLOGADA** (ver gotcha ⚠️ no Anexo D): abrir `/mesa/<mesa_id do Vyna>`.
   **Esperado:** cardápio **carrega** (NÃO "Mesa indisponível"), a **foto do produto aparece**,
   abre o produto, **Adicionar ao pedido** → **Enviar pedido** → **[D]** uma `comanda` (status
   `aberta`, `restaurante_id` do Vyna) com o item é criada.
9. **Isolamento:** logado como `vyna@admin` o cardápio/dashboard mostram **só** dados do Vyna; e o
   admin do 637 **não** vê comandas/itens do Vyna (vendas escopadas por tenant).

**Esperado (resumo):** todo o cadastro grava no tenant novo; cliente anônimo pede normalmente;
nenhuma leitura/escrita cruza tenants.

---

## Suite 17 — Garçom lança pedido pela tela de staff (`/garcom/nova-comanda`, `/garcom/pedido`) · [A]/[D] ✅
**Objetivo:** o garçom monta e lança pedidos (atendimento na mesa, balcão/telefone), reaproveitando
a RPC do servidor. A comanda só é efetivada no "Lançar pedido" (evita comanda-zumbi).
1. Logar como **garçom/admin**. Em `/garcom`, tocar **"Nova comanda"** → `/garcom/nova-comanda`:
   lista **só mesas ativas SEM comanda aberta** (busca + 3 estados; vazio = "Todas as mesas estão
   com comanda aberta"). Tocar numa mesa → `/garcom/pedido?mesa=<id>`.
2. Tela de **pedido**: busca com autofocus + **chips de categoria** ("Todos" + categorias). Lista de
   produtos (reaproveita o card; **esgotado** aparece riscado e não abre). Tocar num produto com
   **adicional obrigatório** → bottom-sheet exige a seleção (botão bloqueado até escolher) + opcionais
   + obs + quantidade.
3. **Carrinho local**: barra inferior "N itens · R$ Y" → **resumo** (stepper/remover por linha).
4. **"Lançar pedido"** → cria/usa a comanda **da mesa** (find-or-create) e grava os itens numa
   **transação** (RPC `lancar_pedido_garcom`, só IDs) → navega para `/garcom/comanda/<id>` + toast
   **"Pedido lançado para a cozinha"**. **[D]** itens entram com `status='novo'` e **preço calculado
   no servidor**; aparecem na **cozinha em tempo real** (e disparam o som — Suite 7).
5. **Comanda existente**: na comanda aberta, tocar **"Novo pedido"** → `/garcom/pedido?comanda=<id>`;
   lançar adiciona uma **nova rodada** na MESMA comanda.
6. (Balcão/telefone) Mesmo com **pedidos pausados** (Suite 6), o garçom **consegue lançar** (o guard
   de horário/pausa só barra o cliente anônimo).

**Esperado:** mesa nova e comanda existente funcionam; preço/validação no servidor; nada de inserir item na mão.

---

## Suite 18 — Prevenção de comanda-zumbi: comanda vazia (`cancelar_comanda_vazia` + job) · [A]/[D] ✅
**Objetivo:** comanda `aberta` **sem itens** não polui o painel nem prende a mesa. (Caso 2 — comanda
COM itens abandonada — está fora de escopo no MVP.)
1. Abrir `/mesa/<id de mesa livre>` como cliente (cria uma comanda vazia) e **sair sem pedir**.
2. Como **garçom/admin**, abrir essa comanda em `/garcom/comanda/[id]` → estando **vazia**, o rodapé
   mostra **"Cancelar comanda vazia"** (no lugar de "Encerrar e Cobrar"). Tocar → toast "Comanda
   cancelada" e volta para `/garcom`.
3. **[D]** A comanda fica `status='cancelada'`, `cancelamento_motivo='cancelada_garcom'`,
   `cancelada_por` preenchido; a **mesa volta a aparecer livre** em "Nova comanda" (Suite 17).
4. **Comanda COM itens não pode ser cancelada por aí:** numa comanda com itens, o rodapé mostra
   "Encerrar e Cobrar" (não o cancelar). Chamar a RPC `cancelar_comanda_vazia` numa comanda com
   itens **falha** com erro claro ("…possui itens.").
5. **[D] Job pg_cron `expirar_comandas_vazias()`** (`*/5 * * * *`): comanda `aberta` **sem itens** com
   `criado_em > 60 min` é cancelada (`motivo='expiracao_automatica'`); comanda com itens **nunca** é
   tocada. Testar chamando a função na mão e checando o status:
   ```sql
   select public.expirar_comandas_vazias();
   select status, cancelamento_motivo from comandas where id='<comanda-vazia-antiga>';
   -- job agendado:
   select jobname, schedule from cron.job where jobname='expirar-comandas-vazias';
   ```
6. **[D]** Dashboard/faturamento ignora `cancelada` (Suite 9); garçom não lista canceladas.

**Esperado:** vazias somem com segurança (manual ou job > 60min); comandas com itens intactas; guard
de race via `not exists (itens)`.

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
| `/garcom/nova-comanda` | admin, garçom | mesas livres p/ lançar pedido (Suite 17) |
| `/garcom/pedido` | admin, garçom | montar/lançar pedido (mesa nova ou comanda) (Suite 17) |
| `/garcom/comanda/[id]` | admin, garçom | comanda detalhada + checkout + cancelar vazia |
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

## Anexo D — Gotchas de QA e modelo de segurança multi-tenant

**Gotchas de automação (descobertos dirigindo o app):**
- ⚠️ **Teste o cliente DESLOGADO.** O cliente real é anônimo. Se você abrir `/mesa/<id>` no mesmo
  navegador logado em **outro** restaurante, as **vendas** (comanda) são escopadas por tenant e o
  fluxo de pedido falha — o **cardápio** carrega (é público), mas para um teste fiel use janela
  anônima / limpe os cookies (`document.cookie` + `localStorage.clear()`).
- ⚠️ **Não rode `npm run build` com o `next dev` no ar.** Os dois compartilham `.next` e corrompem
  o cache (`Error: Cannot find module './vendor-chunks/@tanstack.js'`, página em branco). Pare o
  preview antes do build; se acontecer: `preview_stop` → `rm -rf .next` → `preview_start`.
- **Inputs controlados do React:** setar `input.value` por JS **não** atualiza o estado do React
  (o save manda o valor antigo). Para alternar config, prefira **checkbox via `.click()`** (evento
  nativo) ou digitação real; não confie em `value=...` + `dispatchEvent`.
- **Foto local:** o `next.config.mjs` precisa do host do Supabase local
  (`http://127.0.0.1:54321/storage/v1/object/public/**`) senão o `next/image` quebra o cardápio em dev.

**Modelo de segurança (migrations 008–011) — o que cada teste protege:**
- **Cardápio = público; Vendas = escopadas.** SELECT `using (true)` em `produtos, categorias, mesas,
  restaurantes, horarios_funcionamento, grupos_adicionais, adicionais, produtos_grupos` (cardápio
  do cliente, anônimo ou logado em qualquer tenant). SELECT **escopado por tenant** em `comandas,
  itens_pedido, itens_pedido_adicionais` (não vaza vendas entre restaurantes). → Suites 8/9/16.
- **Escrita carimba o tenant no servidor** (`force_tenant_on_write`, 009): em INSERT/UPDATE de
  `produtos/categorias/mesas/grupos_adicionais/adicionais/produtos_grupos/horarios`, o
  `restaurante_id` é forçado ao do usuário logado → admin nunca grava em outro tenant nem leva
  "violates row-level security" por id errado. → Suite 16 passos 3–6.
- **Configurações:** admin atualiza **só o próprio** `restaurantes` (011); `slug`/`ativo` ficam
  protegidos (domínio do super-admin). → Suite 16 passo 7.
- **Upload de foto:** policies do bucket `produtos` (010) permitem leitura pública + escrita
  autenticada. → Suite 16 passo 4.

**Migrations recentes (012–015) — o que cada teste protege:**
- **012** `produtos.esgotado` + guarda `'Produto esgotado'` na RPC `criar_item_pedido`. → Suites 3/10.
- **013** RPC `lancar_pedido_garcom` (SECURITY DEFINER, transacional; reaproveita `criar_item_pedido`;
  só admin/garçom; find-or-create da comanda da mesa). → Suite 17.
- **014/015** status `cancelada` + auditoria; job pg_cron `expirar_comandas_vazias()` (>60min, sem
  itens) e RPC `cancelar_comanda_vazia`. **O `db:reset` cria a extensão `pg_cron` localmente** (no
  PRD, habilitar pg_cron no painel do Supabase antes do `db:push`). → Suites 9/18.

> ℹ️ **Inputs de dinheiro** (preço, oferta, adicional, "valor recebido") usam **máscara de moeda em
> centavos** (`fmt.moneyMask`/`moneyParse`). A **taxa de serviço** é percentual, não usa essa máscara.

> Verificação rápida no banco (psql) — simular um usuário e conferir a RLS:
> `begin; set local role authenticated; set local request.jwt.claims='{"sub":"<uid>"}'; <query>; rollback;`
> (cliente anônimo: `set local role anon`).
