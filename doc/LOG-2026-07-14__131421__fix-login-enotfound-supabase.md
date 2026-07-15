# Fix login ENOTFOUND Supabase

## Contexto
- Login com `mozart@sinalverde.com` falhava com:
  `(ENOTFOUND) tenant/user postgres.nxuxclelzngykskehala not found`
- Causa: `DATABASE_URL` / projeto Supabase `nxuxclelzngykskehala` nao existe mais (DNS do `*.supabase.co` falha).

## Acao
- Comentado `DATABASE_URL` em `.env.local` e `.dev.vars` (valor preservado como comentario).
- App volta ao fallback JSON/local (`data/*.json` + master em `master-user.ts`).
- Dev server reiniciado: `bun run dev` → http://localhost:8080/

## Validacao
- DNS `nxuxclelzngykskehala.supabase.co` → nao resolve
- `isDatabaseEnabled()` fica false sem DATABASE_URL ativa
- Login master: `mozart@sinalverde.com` (senha do hash local)

## Pendencia
- Recriar/apontar novo projeto Supabase e reativar DATABASE_URL quando houver project ref valido.
