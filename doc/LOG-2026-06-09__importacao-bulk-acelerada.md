# LOG — importação bulk acelerada

**Data:** 2026-06-09  
**Contexto:** importação INSS ~539.946 linhas travada em 0% por muito tempo.

## Solicitação
Acelerar importação de planilha grande.

## Causa raiz
1. Postgres: 1 INSERT por cliente + 1 por assignment (loop) → dezenas de milhares de queries por lote
2. Streaming: fila sequencial de Promises por linha bloqueava o parse
3. UI: `total` só atualizava após o primeiro lote completar

## Alterações
| Arquivo | Mudança |
|---------|---------|
| `clients.repository.ts` | Bulk insert clients + assignments em transação |
| `xlsx-zip-stream.ts` | Parse síncrono, batch 5000, backpressure ao encher lote |
| `import-job.service.ts` | `readXlsxDimensionRowCount` antes do stream; throttle update 2,5s |

## Validação
- `bun run build` — OK

## Próximos passos
- Reiniciar `bun run dev` e testar importação real
- Se ainda lento: COPY/UNLOGGED temporário ou índices desabilitados durante import massivo
