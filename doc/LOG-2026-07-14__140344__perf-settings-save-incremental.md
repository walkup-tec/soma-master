# Performance - save de configuracoes

## Problema
Criar/excluir categoria (e outras configs) demorava muito vs outros sistemas no mesmo Supabase.

## Causa raiz
1. Cada acao regrava **todas** as secoes (categorias + produtos + bancos + status) no Postgres.
2. Dezenas de statements sequenciais (1 menu = 1 INSERT) com RTT Brasil -> us-east-1.
3. DDL de indexes/tabelas na primeira conexao do processo.

## Solucao
- Save por secao: `categories | products | banks | attendanceStatuses`
- Sync em lote via JSON/CTE (2 queries por secao de cat/produto; 1 para bancos/status)
- Cache em memoria das settings no processo
- Skip DDL se indexes ja existem
- Warm connection no boot (`warmDatabaseConnection`)
- Debounce no nome da categoria; UI otimista

## Resultado (benchmark local)
- Antes: ~1.7s+ com rewrite completo / ~20s+ no frio com DDL
- Depois: ~0.85s por save de categorias (secao)

## Arquivos
- `src/lib/config/settings.repository.ts`
- `src/lib/config/settings.server.ts`
- `src/hooks/use-system-settings.ts`
- `src/routes/app/configuracoes.tsx`
- `src/components/settings/user-categories-settings.tsx`
- `src/lib/db/postgres.ts` / `ensure-client-indexes.ts` / `server.ts`
