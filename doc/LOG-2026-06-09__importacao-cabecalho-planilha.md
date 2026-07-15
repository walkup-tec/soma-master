# LOG — 2026-06-09 — Opção cabeçalho na importação Excel

## Solicitação
- Planilha pode ou não ter cabeçalho; usuário deve informar na etapa de importação.

## Alterações
- `src/lib/clients/parse-excel.ts` — `ParseExcelOptions.hasHeader`; sem cabeçalho usa Coluna 1, 2…
- `src/components/clients/client-import-wizard.tsx` — radio na etapa Arquivo; reprocessa ao trocar opção

## Validação
- `bun run build` — OK
