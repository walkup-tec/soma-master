# LOG — Remarketing: Próximos 15/30 sem incluir hoje

## Contexto
Hoje já tem filtro próprio; “Próximos 15/30” não devem repetir o dia atual.

## Solução
`resolveRemarketingDateRange`:
- next15: amanhã … hoje+15
- next30: amanhã … hoje+30

## Arquivo
- `src/lib/dates/local-date.ts`

## Keywords
remarketing, next15, next30, sem hoje
