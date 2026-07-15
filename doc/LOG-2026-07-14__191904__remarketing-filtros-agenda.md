# LOG — Remarketing: lista por agenda + filtros de período

## Contexto
Menu Remarketing era stub. Pedido: exibir clientes com agenda do usuário logado, com filtros Hoje / Ontem / Próximos 15 Dias / Próximos 30 Dias (relativos à data de aplicação do filtro).

## Solução
- Escopo igual à Agenda: master vê todos com `client_schedules`; demais só clientes atribuídos (`client_assignments`)
- Janelas (`resolveRemarketingDateRange`, fuso SP):
  - hoje / ontem: dia único
  - próximos 15: hoje … hoje+14
  - próximos 30: hoje … hoje+29
- API: `listRemarketingFn` + `listRemarketingClientsForUser`
- UI: `RemarketingScreen` com botões no topo, coluna Agenda, ações da lista

## Arquivos
- `src/lib/dates/local-date.ts`
- `src/lib/clients/client.types.ts`
- `src/lib/clients/clients.repository.ts`
- `src/lib/clients/remarketing.server.ts`
- `src/components/remarketing/remarketing-screen.tsx`
- `src/routes/app/remarketing.tsx`
- `src/components/clients/clients-data-table.tsx` (`showContactDate`)

## Como validar
1. Abrir `/app/remarketing` com usuário que tenha leads agendados
2. Alternar filtros e conferir contagem + coluna Agenda
3. Sem permissão no menu `remarketing` → erro de acesso

## Keywords
remarketing, agenda, contact_date, next15, next30, ontem, listRemarketingFn
