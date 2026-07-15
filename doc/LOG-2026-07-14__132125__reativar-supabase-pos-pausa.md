# Reativar Supabase apos pausa

## Contexto
- Projeto `nxuxclelzngykskehala` estava pausado; usuario restaurou.
- URL: https://nxuxclelzngykskehala.supabase.co

## Acao
- Reativado `DATABASE_URL` em `.env.local` e `.dev.vars`
- DNS resolve OK
- `bun run scripts/test-db-connection.ts` → `OK direct:5432` crm_tables: 14
- Dev server reiniciado em http://localhost:8080/

## Validacao
- Login deve autenticar via `crm.users` no Supabase
