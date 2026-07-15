# LOG — Importação sem escolha Tabela/Lista/Kanban

## Contexto
Remover opções de layout na última fase da importação; leads sempre nas listas e no Kanban.

## Solução
- Removido passo **Exibição** do wizard
- Display fixo: `mode: "table"` + `visibleFieldIds` = campos mapeados
- Fluxo: Produto → Arquivo → Indexação → Distribuição → Importar

## Arquivos
- `src/components/clients/client-import-wizard.tsx`
- `src/components/clients/lead-distribution-form.tsx` (texto de ajuda)

## Keywords
import, Exibição, displayMode, lista, kanban
