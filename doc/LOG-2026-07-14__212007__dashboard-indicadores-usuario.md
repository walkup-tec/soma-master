# LOG — Dashboard com indicadores do usuário logado

## Contexto
Dashboard usava mocks. Pedido: linkar indicadores ao usuário logado.

## Solução
- `getDashboardSummaryForUser` / `getDashboardSummaryFn`
- Escopo: master = todos; demais = `client_assignments` (+ agenda com regra já usada)
- KPIs: meus clientes, leads do dia, em aberto, concluídos, perdidos, agenda hoje/atrasada, em atendimento
- Últimos clientes, pizza por status, painel agenda do dia + atalhos
- Removidos gráficos mock (ROI, conversão fictícia, etc.)

## Arquivos
- `src/lib/clients/dashboard.types.ts`
- `src/lib/clients/dashboard.server.ts`
- `src/lib/clients/clients.repository.ts`
- `src/routes/app/index.tsx`

## Keywords
dashboard, KPI, getDashboardSummaryFn, usuario logado
