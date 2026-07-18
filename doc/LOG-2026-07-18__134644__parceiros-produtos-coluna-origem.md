# LOG — 2026-07-18__134644 — parceiros-produtos-coluna-origem

## Contexto
Na lista Parceiros → Produtos, coluna "Tabela" deveria ser **Origem** com tag + check:
- Parceiros (`partnerOnly`)
- Produção própria (`availableForPartners` sem partnerOnly)

## Solução
- Lista restaurada (produto × banco) com coluna Origem e `OriginTag`
- "+ Novo produto" continua abrindo o wizard `ProductsSettings catalog="partners"`

## Arquivos
- `partner-products-catalog-screen.tsx`
- `parceiros.produtos.tsx` (loader de rows)

## Keywords
parceiros, produtos, origem, partnerOnly, tag
