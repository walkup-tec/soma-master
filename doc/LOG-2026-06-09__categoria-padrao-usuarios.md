# LOG — Categoria padrão para novos usuários

**Data:** 2026-06-09  
**Solicitação:** Permitir marcar qualquer categoria criada como "Padrão"; novos usuários herdam menus/permissões.

## Alterações
- `src/lib/config/category-utils.ts` — helpers `getDefaultCategory`, `resolveUserCategoryTemplate`, `menuLabelsForCategory`
- `src/components/settings/user-categories-settings.tsx` — UX: alerta explicativo, estrela na lista, switch no painel de edição, checkbox ao criar nova categoria

## Validação
- `bun run build` — OK

## Pendências
- Tela de cadastro de usuários (ainda não existe) deve usar `resolveUserCategoryTemplate(settings)` ao criar
- Filtrar sidebar pelo `menuIds` da categoria do usuário logado
