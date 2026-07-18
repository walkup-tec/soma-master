# LOG — 2026-07-18__133929 — tabelas-parceiros-multiselect

## Contexto
No modal Criar/Editar tabela, Parceiros usava lista de checkboxes (“bolinha”). Pedido: select de múltipla seleção.

## Solução
Troca por `MultiSelectFilter` (mesmo padrão de filtros do CRM): trigger tipo select + popover com checkboxes.

## Arquivos
- `src/components/partners/partner-tables-screen.tsx`

## Keywords
tabelas, parceiros, multi-select, MultiSelectFilter
