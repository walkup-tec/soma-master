# LOG — 2026-07-18__134100 — tabelas-valor-fixo-min-max

## Contexto
Com "Valor fixo" marcado, havia um único input "Valor (Flat e Repasse)". Pedido: dois inputs como no percentual — Valor mínimo e Valor máximo (R$).

## Solução
- UI: grid com Valor mínimo / Valor máximo (máscara BRL)
- Persistência: `flat_cents` = mín, `repasse_cents` = máx, `fixed_value_cents` = mín (compat)
- Validação: máx >= mín

## Arquivos
- `partner-tables-screen.tsx`, `partner-catalog.types.ts`, `.server.ts`, `.repository.ts`

## Keywords
tabelas, valor fixo, minimo, maximo, flat_cents, repasse_cents
