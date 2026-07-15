# LOG — Categorias sem flag "padrão"

**Data:** 2026-06-09  
**Decisão:** Toda categoria criada pelo master já é modelo de permissões; remover toggle/estrela/badge `isPadrao`.

## Alterações
- Removido `isPadrao` de `UserCategory`
- UI simplificada: lista + edição de nome/menus apenas
- `listAssignableCategories` retorna todas as categorias

## Validação
- `bun run build` — OK
