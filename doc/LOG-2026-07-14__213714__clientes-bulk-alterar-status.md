# LOG — Clientes: ação em lote Alterar status

## Contexto
Na tela Clientes → Seleção Filtro → Ações, era necessário alterar o status de todos os clientes da seleção (filtro aplicado ou IDs).

## Solução
1. `bulkUpdateClientStatus` — resolve escopo e faz `UPDATE crm.clients SET status`.
2. `bulkUpdateStatusFn` — valida status nas configs; registra nota de atendimento em lote; aplica retorno automático se o status tiver `autoReturnDays`.
3. Modal **Ações**: opção **Alterar status** com select dos status de atendimento.

## Arquivos
- `src/lib/clients/client-bulk.repository.ts`
- `src/lib/clients/clients.server.ts`
- `src/components/clients/client-bulk-actions-modal.tsx`

## Como validar
1. Clientes → aplicar filtros → **Seleção Filtro** → **Ações** → **Alterar status**.
2. Escolher status → Confirmar → lista atualiza e aparece toast com quantidade.

## Keywords
bulk status, alterar status lote, Seleção Filtro, bulkUpdateStatusFn
