# LOG — 2026-06-09 — fix importação planilha grande (parse OOM)

## Contexto
- Usuário testou importação na porta **8082** e recebeu erro de arquivo "corrompido no envio".
- Planilha: `planilha teste clientes inss.xlsx` (~165 MB, 539.947 linhas).
- Upload/chunks OK (header ZIP `PK`, tamanho correto em `data/uploads/`).

## Causa raiz
- `parse-excel-server.ts` fazia `XLSX.read()` + `sheet_to_json` na matriz **inteira** → OOM/timeout → matriz vazia → mensagem enganosa de corrupção.

## Correção
- Novo `src/lib/clients/xlsx-zip-stream.ts`:
  - Contagem de linhas via `<dimension ref="…">` no ZIP (ms).
  - Prévia com `sheetRows: 7` (cabeçalho + 5 linhas) — ~19–23s.
  - Importação via streaming do `sheet1.xml` + `sharedStrings.xml`.
- `parse-excel-server.ts` delega para o módulo acima.

## Validação
```bash
bun run scripts/test-parse-preview.ts
# totalRows: 539946, headers CPF/Nome/…, ~23s

bun -e "parseExcelPreviewFromPath(...)" 
# OK 539946 CPF Nome ~19s

bun run build # OK
```

## Pendências
- Testar fluxo completo na UI (8082): upload → prévia → mapeamento → import.
- `clients.json` não escala para 540k registros (precisa DB futuro).
- Dev server pode precisar restart para pegar código novo.

## Arquivos alterados
- `src/lib/clients/xlsx-zip-stream.ts` (novo)
- `src/lib/clients/parse-excel-server.ts`
- `scripts/test-parse-preview.ts`, `scripts/test-parse-stream.ts`
