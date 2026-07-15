# LOG — Filtro Com agenda (Clientes)

**Data:** 2026-06-09

## Solicitação
Adicionar botão de filtro **Com agenda** para listar apenas clientes com agenda gravada.

## Alterações
- `client.types.ts` — `ClientScheduleFilter`, campo `schedule` em `ClientsPageQuery`
- `clients.repository.ts` — `exists` em `crm.client_schedules`; filtro disco via `hasSchedule`
- `clients.server.ts` — repasse de `schedule` no payload
- `clients-screen.tsx` — botão **Com agenda**, estado `scheduleFilter`, incluso em **Limpar filtros**

## Validação
- `bun run build` — OK

## Pendências
- Teste manual na UI (`/app/clientes`)
- Commit/deploy não solicitados
