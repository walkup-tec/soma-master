# LOG — Tela Inicial por tipo de usuário (categoria)

## Contexto
Em Configurações → tipo de usuários (categorias), escolher qual tela abre primeiro no login, apenas entre menus com permissão da categoria.

## Solução
1. `UserCategory.homeMenuId` + select **Tela Inicial** na edição da categoria (só menus marcados).
2. Postgres: coluna `crm.user_categories.home_menu_id` (default `dashboard`).
3. Sessão carrega `homeMenuId`; `firstAllowedAppPath` usa essa tela; login redireciona para ela.
4. Se o menu da tela inicial for desmarcado, recalcula para Dashboard ou o primeiro menu permitido.

## Arquivos
- `settings-types.ts`, `settings-defaults.ts`, `category-utils.ts`, `settings.repository.ts`, `seed.ts`
- `session-config.ts`, `auth.server.ts`, `menu-access.ts`
- `user-categories-settings.tsx`, `login.tsx`, `app.tsx`

## Validação
1. Configurações → categoria Atendente → marcar Kanban → Tela Inicial = Kanban → salvar.
2. Login com usuário dessa categoria → deve abrir `/app/kanban`.

## Keywords
tela inicial, homeMenuId, categoria, firstAllowedAppPath
