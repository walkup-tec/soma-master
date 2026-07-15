# Filtro por Status na lista de Clientes

## Contexto
Na tela Clientes, faltava select de Status de atendimento (Novo, Em atendimento, etc.).

## Solucao
- Query/API: campo `status` em `ClientsPageQuery` e `ClientBulkFilters`
- SQL/disk: `c.status = :status`
- UI: select ao lado de Produto com `settings.attendanceStatuses`
- Selecao Filtro inclui o status ativo

## Arquivos
- `clients-screen.tsx`, `client.types.ts`, `clients.repository.ts`, `clients.server.ts`, `client-bulk.repository.ts`
