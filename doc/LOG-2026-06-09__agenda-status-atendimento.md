# Snapshot — Agenda igual Clientes + status configurável

**Data:** 2026-06-09

## Solicitação aberta
- Agenda com mesma exibição que Clientes (Cliente, Produto, Status, Ação + mesmos botões)
- Modal de atendimento: alterar status
- Status de atendimento configurável em Configurações

## Arquivos alterados
- `src/components/clients/clients-data-table.tsx` (novo)
- `src/components/clients/client-list-action-layer.tsx` (novo)
- `src/components/settings/attendance-statuses-settings.tsx` (novo)
- `src/components/clients/clients-screen.tsx`
- `src/components/agenda/agenda-screen.tsx`
- `src/components/clients/client-attendance-dialog.tsx`
- `src/routes/app/configuracoes.tsx`
- `src/lib/clients/clients.repository.ts` — `listScheduledClientsForUser`, `updateClientStatus`
- `src/lib/clients/clients.server.ts` — `updateClientStatusFn`
- `src/lib/clients/agenda.server.ts`
- `src/lib/clients/client.types.ts`
- `src/lib/clients/client-status.ts`
- `src/lib/config/settings-types.ts`, `settings-defaults.ts`, `settings.repository.ts`
- `src/lib/db/ensure-client-indexes.ts` — tabela `crm.attendance_statuses`

## Validação
- `bun run build` — OK

## Pendências
- Deploy / commit (não solicitado)
- Teste manual em `/app/agenda` e Configurações → Status de atendimento
