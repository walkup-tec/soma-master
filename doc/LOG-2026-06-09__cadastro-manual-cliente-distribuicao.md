# LOG — 2026-06-09 — Cadastro manual de cliente + distribuição

## Contexto / solicitação
- Modal de criação manual de cliente em `/app/clientes`
- Passo 1: escolher produto (define campos obrigatórios)
- Passo 2: preencher dados do cliente
- Passo 3: distribuição de leads (todos / categorias / usuários)

## Arquivos alterados/criados
- `src/components/clients/client-create-manual-dialog.tsx` (novo)
- `src/components/clients/lead-distribution-form.tsx` (novo, compartilhado)
- `src/components/clients/clients-screen.tsx` — botão Novo cliente
- `src/lib/clients/clients.repository.ts` — `createManualClient`
- `src/lib/clients/clients.server.ts` — `createManualClientFn`
- `src/lib/clients/client.types.ts` — `CreateManualClientPayload`
- `doc/memoria.md` — atualizado

## Comandos
- `bun run build` — OK (client + ssr)

## Validação
- Build sem erros TypeScript
- Fluxo: produto → validação obrigatórios → distribuição → persistência

## Pendências
- Testar manualmente no dev server (`bun run dev`)
- Exibição dinâmica kanban/tabela/lista na listagem
- Deploy Cloudflare
