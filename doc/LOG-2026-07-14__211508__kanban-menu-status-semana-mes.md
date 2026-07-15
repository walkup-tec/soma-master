# LOG — Menu Kanban (Status / Semanal / Mensal)

## Contexto
Pedido: menu Kanban com vistas Status, Semanal e Mensal; cards abrem o modal de atendimento; escopo = clientes do usuário logado.

## Solução
- Menu `kanban` → `/app/kanban` (Operação)
- `listKanbanFn` / `listKanbanClientsForUser` — assignment (não-master) ou todos (master); até 800 cards
- Vistas:
  - **Status** — colunas = `attendanceStatuses`
  - **Semanal** — dias da semana atual (seg–dom, fuso SP); data = agenda ou createdAt
  - **Mensal** — dias do mês atual
- Clique no card → `ClientListActionLayer` / modal de atendimento

## Arquivos
- `src/lib/config/menu-items.ts`, `menu-nav.tsx`, `settings-defaults.ts`
- `src/lib/clients/kanban.server.ts`, `kanban-board.ts`, `clients.repository.ts`
- `src/components/kanban/kanban-screen.tsx`
- `src/routes/app/kanban.tsx`, `routeTree.gen.ts`, `app-topbar.tsx`
- `src/lib/dates/local-date.ts` (helpers de semana/mês)

## Validar
1. Habilitar menu Kanban na categoria do usuário (Configurações), se necessário
2. Abrir `/app/kanban` e alternar Status / Semanal / Mensal
3. Clicar em um card → modal de atendimento

## Keywords
kanban, status, semanal, mensal, ClientAttendanceDialog, listKanbanFn
