# LOG — Correção: múltiplas categorias padrão

**Data:** 2026-06-09  
**Correção:** Usuário esclareceu que Master, Atendente e Gerente podem ser **todas** padrão. Padrão = modelo de permissões atribuível no cadastro de usuário, não “a única categoria default”.

## Alterações
- `settings-types.ts`: `isPadrao` por categoria; removido `defaultCategoryId`
- `settings-defaults.ts`: Master, Atendente, Gerente com `isPadrao: true`; migração de `isDefault` legado
- `category-utils.ts`: `listPadraoCategories`, `listAssignableCategories`
- `user-categories-settings.tsx`: estrela/switch alternam `isPadrao` independentemente

## Validação
- `bun run build` — OK
