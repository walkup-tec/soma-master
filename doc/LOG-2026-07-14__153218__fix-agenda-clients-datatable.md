# Fix agenda — This page didn't load

## Contexto
- URL: `http://localhost:8080/app/agenda?filter=today`
- UI: error boundary `This page didn't load` / Try again / Go home

## Causa raiz
Ao adicionar multi-seleção em Clientes, `ClientsDataTable` passou a exigir
`selectedIds` / `onToggleRow` / `onTogglePage` obrigatórios.
A Agenda reutiliza a mesma tabela **sem** esses props → crash em render
(`selectedIds.has` em undefined) quando há ≥1 lead agendado.

## Solução
1. Seleção ficou **opcional** em `clients-data-table.tsx`; sem props, esconde checkboxes.
2. Agenda SQL alinhada com `product_ids` (junction `client_products`), igual à lista de clientes.

## Arquivos
- `src/components/clients/clients-data-table.tsx`
- `src/lib/clients/clients.repository.ts`

## Validação
- Query `listScheduledClientsForUser(..., today)` OK (3 itens no teste local)
- Recarregar `/app/agenda?filter=today` — deve listar leads sem error boundary
