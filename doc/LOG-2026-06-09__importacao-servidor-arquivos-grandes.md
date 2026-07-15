# LOG — 2026-06-09 — Importação server-side para arquivos grandes

## Problema
- `planilha teste clientes inss.xlsx` (~165 MB, ~540k linhas) não importava no browser (memória/timeout)

## Solução
- Arquivos ≥ 5 MB: upload em chunks para o servidor + processamento no Node
- Job de importação em background com progresso via polling
- Prévia e contagem de linhas no servidor (sem carregar tudo no browser)

## Arquivos novos/alterados
- `import-upload.repository.ts`, `import-job.repository.ts`, `import-job.service.ts`
- `parse-excel-server.ts`, `upload-file-chunks.ts`
- `clients.server.ts` — fns de upload/preview/job
- `client-import-wizard.tsx` — fluxo servidor + progresso upload/import
- `client-import-progress.tsx` — fase uploading

## Validação
- `bun run build` — OK

## Uso
1. `bun run dev` → http://localhost:8081 (ou 8080)
2. Clientes → Importar → selecionar planilha INSS
3. Marcar cabeçalho Sim; aguardar envio + análise (vários minutos)
4. Indexar colunas (CPF, Nome, etc.) → Importar
