# Fix lentidao menus laterais

## Causas
1. `app.tsx` a cada 5s fazia `refreshSession` + `router.invalidate()` - refetch de todos os loaders (clientes/agenda).
2. `getAuthSessionFn` enriquecia sessao (user + settings) em todo `beforeLoad` de navegacao.
3. Links sem preload.

## Fix
- Poll de sessao a cada 120s; invalidate so se menu/role/categoria mudarem
- Cache enrich sessao 45s
- `staleTime` em /app, clientes, agenda
- `preload=intent` no sidebar
- ensure indexes: sem DDL repetido apos ensured=true

## Arquivos
- routes/app.tsx, clientes.tsx, agenda.tsx
- auth.server.ts, app-sidebar.tsx, ensure-client-indexes.ts
