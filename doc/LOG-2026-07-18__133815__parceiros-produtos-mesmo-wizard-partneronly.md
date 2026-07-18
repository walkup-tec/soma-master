# LOG — 2026-07-18__133815 — parceiros-produtos-mesmo-wizard-partneronly

## Contexto
Em PARCEIROS → Produtos, "+ Novo produto" abria um modal simples. O pedido é usar o **mesmo processo/tela** da Produção própria (Configurações → Produtos), com a diferença de que o produto fica `partnerOnly` (visível aos parceiros, ausente da Produção própria).

## Solução
1. `ProductsSettings` ganhou `catalog?: "production" | "partners"`:
   - partners: lista só `partnerOnly`; cria com `partnerOnly` + `availableForPartners`; sem etapa Sim/Não Parceiros
   - merge ao salvar preserva o outro catálogo
2. `syncProducts` passa a sincronizar os dois subconjuntos (`partner_only` true/false) isolados
3. `createEmptyProduct({ partnerOnly })` 
4. `/app/parceiros/produtos` renderiza `ProductsSettings catalog="partners"` via `useSystemSettings`

## Arquivos
- `src/components/settings/products-settings.tsx`
- `src/components/partners/partner-products-catalog-screen.tsx`
- `src/routes/app/parceiros.produtos.tsx`
- `src/lib/config/settings.repository.ts`
- `src/lib/config/settings-defaults.ts`

## Validação
- `vite build` OK
- Após deploy: Parceiros → Produtos → Novo produto = wizard igual; produto não aparece em Configurações → Produtos (produção)

## Keywords
parceiros, produtos, partnerOnly, products-settings, wizard, catalog partners
