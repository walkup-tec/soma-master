# LOG — 2026-06-10 — prévia importação via streaming XML

## Problema
- Upload OK, barra de progresso completa, fase "Lendo planilha" → alerta:
  "Não foi possível ler a prévia da planilha. Aguarde o envio terminar e tente novamente."
- Upload `upload-c31e08fe-00a`: 173 MB, 166 chunks, arquivo íntegro (PK, 539946 linhas).

## Causa
- `parseXlsxPreviewLimited` ainda usava `XLSX.read(buffer)` em 165 MB.
- No contexto do servidor (TanStack/Vite), retornava matriz vazia; no script direto funcionava (~20s).

## Correção
- Prévia 100% via streaming do `sheet1.xml` + `sharedStrings.xml`.
- Sem `XLSX.read` na prévia; só `decode_range` para dimension.
- Tempo: ~4s (primeira leitura) vs ~23s antes.

## Validação
```bash
bun run scripts/test-parse-preview.ts data/uploads/upload-c31e08fe-00a/file.bin
# totalRows: 539946, ~4.4s
```

## Próximo passo usuário
- Reiniciar `bun run dev` se já estava aberto (hot reload pode não pegar server fn).
- Reimportar planilha na UI.
