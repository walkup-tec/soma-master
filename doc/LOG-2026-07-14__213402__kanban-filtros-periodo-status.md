# LOG — Kanban: filtros período (Status) e status (Semanal/Mensal)

## Contexto
Pedido: no Kanban Status, filtrar por Dia / Semana / 15 / 30 dias e ver todos os status numa única tela (grade dinâmica). Nas vistas Semanal e Mensal, filtrar por Status e manter o quadro em uma tela.

## Solução
1. **Status — período** (`KanbanPeriodPreset`): Dia (hoje), Semana (seg–dom atual), 15 dias (últimos 15), 30 dias (últimos 30), usando data do board (`contactDate` ou `createdAt` local SP).
2. **Semanal/Mensal — status**: `MultiSelectFilter` (vazio = todos).
3. **Layout Status**: só colunas com cards; `layoutKanbanStatusGrid` calcula linhas×colunas; grid `h-[min(78vh,820px)]` com células `fillParent`.
4. **Semanal**: 7 colunas com altura de viewport; **Mensal**: semanas com altura igual (já existente).

## Arquivos
- `src/lib/clients/kanban-board.ts` — filtros, período, layout grid
- `src/components/kanban/kanban-screen.tsx` — UI dos filtros + grade dinâmica

## Como validar
1. `/app/kanban?view=status` → alternar Dia/Semana/15/30; conferir contagem e grade sem scroll horizontal.
2. Semanal/Mensal → selecionar 1–N status; cards filtram; calendário permanece em tela.

## Keywords
kanban filtro período, Dia Semana 15 30, MultiSelectFilter status, layoutKanbanStatusGrid
