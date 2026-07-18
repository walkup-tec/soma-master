# LOG — 2026-07-18__141300 — tabela-padrao-categorias-multiselect

## Contexto
Com "Tabela padrão", o select de categoria era único. Pedido: multi-select com primeira opção "Todos".

## Solução
- `MultiSelectFilter` + opção `all` (Todos) mutuamente exclusiva
- Persistência em `partner_category` (texto): `"all"`, categoria única ou JSON `["a","b"]`
- Helpers: `parsePartnerCategories` / `serializePartnerCategories` / `togglePartnerCategorySelection`

## Arquivos
- `partner.constants.ts`, `partner-catalog.types|server|repository.ts`, `partner-tables-screen.tsx`

## Keywords
tabela padrao, categorias, multi-select, Todos, partnerCategories
