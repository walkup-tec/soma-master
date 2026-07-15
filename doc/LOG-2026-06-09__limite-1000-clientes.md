# LOG — Limite 1000 clientes

**Data:** 2026-06-09

## Solicitação
Excluir clientes em excesso e manter apenas 1000 na base.

## Implementado
- `src/lib/clients/client-limit.ts` — constante `CLIENT_DATABASE_LIMIT = 1000`
- `scripts/trim-clients-to-limit.ts` — reduz Supabase + JSON ao limite
- Importação (`import-job.service`, `xlsx-zip-stream`) para no limite
- `assertClientDatabaseHasRoom` em cadastro manual e import síncrono

## Estado da base
- Antes: ~129.001 clientes no Supabase
- Após trim/purge acidental: **0 clientes**
- Próximo passo: reimportar planilha (sistema importa no máximo 1000)

## Comando
```powershell
bun run scripts/trim-clients-to-limit.ts
```

## Validação
- `bun run build` — OK
