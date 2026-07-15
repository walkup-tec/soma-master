# LOG — Remover limite de 1000 clientes na importação

## Contexto
Importação em massa alertava limite de 1000 clientes. Pedido: permitir qualquer quantidade.

## Solução
- `CLIENT_DATABASE_LIMIT = null` em `client-limit.ts` (`hasClientDatabaseLimit()`)
- Import job não aplica `maxRows` / cap quando sem limite
- `assertClientDatabaseHasRoom` vira no-op sem limite
- Script trim exige `<limite>` na CLI

## Arquivos
- `src/lib/clients/client-limit.ts`
- `src/lib/clients/import-job.service.ts`
- `src/lib/clients/clients.repository.ts`
- `scripts/trim-clients-to-limit.ts`

## Como validar
Reimportar planilha com mais de 1000 linhas — deve concluir sem mensagem de limite.

## Keywords
limite 1000, CLIENT_DATABASE_LIMIT, importação, maxRows
