# LOG — Parceiros: Bancos, Produtos e Tabelas de comissão

**Data:** 2026-07-17 23:15  
**Repo:** Soma-explore  
**Commit assunto:** `[169448b] feat: menus Parceiros Bancos Produtos e Tabelas de comissao`

## Contexto

Menus e telas administrativas sob Parceiros para catálogo de bancos, produtos (`partnerOnly`) e tabelas de comissão. Schema de solicitação de acesso a bancos pelos parceiros já preparado; UI “solicitar acesso” fica para o próximo passo.

## Alterações

### Produção própria vs produtos só-parceiro

- `products-settings.tsx`: lista/edita apenas `!product.partnerOnly`.
- No persist: `mergeOwnWithPartnerOnly` reanexa os `partnerOnly` de `settings.products` para não apagá-los ao salvar Configurações → Produtos.
- Backend `syncProducts` já preserva `partner_only` no Postgres.

### Rotas TanStack

- Novas rotas: `/app/parceiros/bancos`, `/app/parceiros/produtos`, `/app/parceiros/tabelas`.
- `npx @tanstack/router-cli generate` indisponível (npm cache ENOENT); `routeTree.gen.ts` atualizado manualmente no padrão nested de `clientes.novo` (filhos de `AppParceirosRoute` + `AppParceirosRouteWithChildren`).

### Outros arquivos (já no working tree)

- Menus (`menu-items`, `menu-nav`), settings types/defaults/repository, `ensure-partner-schema`, componentes/repos/server/types do catálogo parceiros, rotas `parceiros.*.tsx`.

### Cache

- Confirmado: `clearSystemSettingsCache` exportado em `src/lib/config/settings.repository.ts`.

## Schema-ready / próximo passo

- Tabela/fluxo `partner_bank_access_requests` está schema-ready.
- **Pendente:** tela parceiro-facing “solicitar acesso” aos bancos.

## Como validar

1. Redeploy Easypanel / Maker com SHA do commit no título.
2. Menu Parceiros → Bancos / Produtos / Tabelas.
3. Configurações → Produtos: não deve listar `partnerOnly`; salvar não deve remover produtos só-parceiro.
4. `clearSystemSettingsCache` importável do repository.

## Keywords

parceiros, bancos, produtos, tabelas comissao, partnerOnly, routeTree, partner_bank_access_requests, solicitar acesso
