# LOG — 2026-07-18__000404 — fix-parceiros-submenu-navegacao

## Contexto
Clicar em Bancos / Produtos / Tabelas no menu PARCEIROS mantinha a tela "Rede de parceiros" (lista).

## Causa
`/app/parceiros` era rota **folha** (lista sem `<Outlet />`), enquanto Bancos/Produtos/Tabelas eram irmãs flat sob `/app` com path prefix compartilhado. O match/navegação não trocava o conteúdo corretamente.

## Solução
1. `parceiros.tsx` → layout só com `<Outlet />`
2. `parceiros.index.tsx` → lista de parceiros
3. `parceiros.bancos|produtos|tabelas` → filhos com path `/bancos`, `/produtos`, `/tabelas`
4. `routeTree.gen.ts` regenerado pelo Vite (layout + children)
5. Sidebar `isActive` via `menuIdForPath` (maior prefixo) para não marcar "Parceiros" em `/parceiros/bancos`

## Arquivos
- `src/routes/app/parceiros.tsx`
- `src/routes/app/parceiros.index.tsx` (novo)
- `src/routeTree.gen.ts`
- `src/components/app-sidebar.tsx`

## Validação
- `vite build` OK (chunk `parceiros.index-*.js`)
- Após deploy: clicar Bancos → catálogo de bancos; Produtos / Tabelas idem; Parceiros → lista

## Keywords
parceiros, submenu, outlet, routeTree, layout-index, navegacao, tanstack-router
