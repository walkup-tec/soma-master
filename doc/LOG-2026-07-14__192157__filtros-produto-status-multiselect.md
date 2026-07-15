# LOG — Filtros Produto e Status com múltipla escolha

## Contexto
Na tela Clientes, os selects “Todos os produtos” e “Todos os status” eram escolha única. Pedido: múltipla escolha.

## Solução
- UI: `MultiSelectFilter` (Popover + checkboxes)
- Query: `productIds[]` e `statuses[]` em `ClientsPageQuery` / bulk (compatível com `productId`/`status` legados)
- SQL: `= any(array)` em listagem e ações em lote

## Arquivos
- `src/components/ui/multi-select-filter.tsx`
- `src/components/clients/clients-screen.tsx`
- `src/lib/clients/client.types.ts`
- `src/lib/clients/clients.repository.ts`
- `src/lib/clients/client-bulk.repository.ts`
- `src/lib/clients/clients.server.ts`

## Keywords
multiselect, productIds, statuses, filtros clientes
