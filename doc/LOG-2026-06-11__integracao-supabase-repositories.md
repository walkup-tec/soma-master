# LOG — 2026-06-11 — integração Supabase nos repositories

## Feito
- `src/lib/db/postgres.ts` — pool PostgreSQL (ssl, prepare: false)
- `src/lib/db/seed.ts` — seed master + settings padrão se vazio
- Repositories com Supabase + fallback JSON:
  - settings.repository.ts
  - user.repository.ts
  - clients.repository.ts (batch insert + assignments)
  - import-job.repository.ts
  - import-upload.repository.ts (metadados no DB, chunks em disco)
- `scripts/migrate-json-to-supabase.ts` — migração opcional de data/*.json
- `bun run build` OK

## Validação
- `test-db-connection.ts` → crm_tables: 10
- `test-db-integration.ts` → users/products/categories OK do Supabase

## Uso
- Com `DATABASE_URL` no `.env.local` → dados no Supabase
- Sem `DATABASE_URL` → continua em `data/*.json`
- Migrar JSON antigo: `bun run scripts/migrate-json-to-supabase.ts`
