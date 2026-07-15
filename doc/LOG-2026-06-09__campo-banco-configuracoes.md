# LOG — 2026-06-09 — Campo Banco + Configurações de Bancos

## Solicitação
- Campo "Banco" opcional em todos os produtos
- Configurações de Bancos com input texto

## Alterações
- `client-fields.ts` — `banco` em dados financeiros
- `settings-types.ts` — `BankConfig`, `banks[]` em `SystemSettings`
- `settings-defaults.ts` — `normalizeBanks`, `createEmptyBank`
- `banks-settings.tsx` — aba Configurações
- `client-field-input.tsx` — select de bancos no cadastro manual
- `configuracoes.tsx` — tab Bancos

## Validação
- `bun run build` — OK
