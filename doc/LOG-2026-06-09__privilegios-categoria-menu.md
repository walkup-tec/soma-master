# LOG — Privilégios por categoria

**Data:** 2026-06-09

## Implementado
- Menus dinâmicos via `MENU_ITEMS` (path, group, label)
- Sidebar filtra por `auth.menuIds`
- Guard de rota em `/app` (`menu-guard.server.ts`)
- Settings no servidor (`data/system-settings.json`)
- Categorias em Configurações listam todos os `MENU_ITEMS` automaticamente

## Validação
- `bun run build` — OK
