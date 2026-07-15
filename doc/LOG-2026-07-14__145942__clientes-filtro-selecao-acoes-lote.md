# Clientes: filtro data, Selecao Filtro, acoes em lote

## Pedido
- Filtro Data de criacao (mascara)
- Selecao Filtro + modal de acoes
- Agendar para usuario / Adicionar produto (multi) / Exclusao
- Atendimentos com autor; so exclui o proprio

## Feito
- `ClientsPageQuery.createdDate` + where SP timezone
- Checkboxes + Selecao Filtro (scope filter ou ids)
- `client-bulk.repository.ts` + server fns
- `crm.client_products` (multi-produto sem duplicar cliente)
- Modal `client-bulk-actions-modal.tsx`
- delete attendance com guard de autor

## Arquivos principais
- clients-screen / clients-data-table / client-bulk-actions-modal
- clients.repository / client-bulk.repository / clients.server
- ensure-client-indexes / client-attendance*
