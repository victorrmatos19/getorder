---
name: qa
description: Executa o roteiro de QA do GetOrder (test/ROTEIRO.md), dirigindo o app local no navegador e reportando PASS/FAIL. Use quando o usuário pedir para rodar os testes/QA do sistema. Opcional: número da suite (ex.: /qa 8) para rodar só uma.
disable-model-invocation: true
argument-hint: "[número da suite (opcional)]"
allowed-tools: Read Bash(npm *) Bash(docker *) Bash(curl *) mcp__Claude_Preview__preview_start mcp__Claude_Preview__preview_eval mcp__Claude_Preview__preview_snapshot mcp__Claude_Preview__preview_screenshot mcp__Claude_Preview__preview_fill mcp__Claude_Preview__preview_resize mcp__Claude_Preview__preview_console_logs mcp__Claude_Preview__preview_stop
---

# QA — GetOrder

Você é o executor de QA do GetOrder. Rode os testes **somente no ambiente LOCAL** (Supabase
Docker), **nunca no PRD**. O roteiro completo está em `test/ROTEIRO.md` — **leia-o primeiro** e
siga-o como fonte da verdade.

## Argumento
- `$ARGUMENTS` vazio → rodar **todas** as suites do roteiro.
- `$ARGUMENTS` com um número → rodar **apenas** essa suite (ex.: `8` = Garçom + checkout).

## Preparação do ambiente (nesta ordem)
1. **Trava de segurança:** confirme que `.env.local` aponta para o local
   (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`). Se apontar para `*.supabase.co` (PRD),
   **PARE** e avise o usuário — não rode nada.
2. Garanta o Supabase local no ar: `docker ps` deve listar `supabase_db_getorder`. Se não,
   `npm run db:start` (a 1ª vez baixa imagens; pode demorar).
3. **Bateria completa** (todas as suites): `npm run db:reset` e, em seguida, redefina as senhas
   de teste (o reset recarrega os hashes do PRD):
   `docker exec supabase_db_getorder psql -U postgres -d postgres -c "update auth.users set encrypted_password = crypt('teste1234', gen_salt('bf')) where email in ('637@admin.com','637@cozinha.com','637@garcom.com');"`
   Para **uma única suite**, **pule** o reset (não apague o estado atual).
4. Suba o dev server pelo Preview: `preview_start` com a config `dev` (de `.claude/launch.json`).
   Se a porta 3000 estiver ocupada por outro processo (não-preview), libere-a antes e tente de novo.
5. Pegue um `mesa_id` ativo:
   `docker exec supabase_db_getorder psql -U postgres -d postgres -t -A -F"|" -c "select id, nome from mesas where ativo order by nome;"`

## Execução
- Siga `test/ROTEIRO.md` suite a suite (Objetivo → Passos → Resultado esperado).
- Dirija o navegador com as ferramentas de Preview (`preview_eval`, `preview_snapshot`,
  `preview_screenshot`, `preview_fill`, `preview_resize`).
- Respeite as **dicas de automação** do roteiro:
  - viewport **mobile (390px)** no fluxo do cliente; tablet/desktop no staff/admin;
  - clicar botões por texto com **`includes()`**, nunca igualdade exata (há emojis: "🍔Lanches", "📱PIX");
  - **esperar ~1–2,5s** após navegação, login, envio de pedido (queries assíncronas + realtime);
  - login: preencher `input[type=email]` e `input[type=password]`, clicar `button[type=submit]`;
  - ler o **console** (erros/warnings) ao fim de cada suite e registrar qualquer ocorrência.
- Asserções por **invariante** (não valores R$ fixos, que mudam com o seed):
  - "Total da comanda = Subtotal + Taxa de serviço";
  - "Total do checkout (garçom) == Total da Minha Comanda (cliente)" para a mesma comanda;
  - "Total do garçom (lista) inclui adicionais".

## Encerramento
- Ao terminar, **pare o servidor de preview** (`preview_stop`) se você o iniciou nesta execução.

## Relatório final
Apresente uma tabela **Suite → PASS / FAIL / BLOCKED**, com evidência (screenshot/snapshot) e
logs de console nas falhas. Em FAIL: rota, passo, **esperado × obtido** e o erro de console/rede.
**Não invente PASS** — se não conseguiu verificar algo, marque **BLOCKED** e explique o motivo.
