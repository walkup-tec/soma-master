# Fix indexacao Excel + Agendamento Contato na importacao

## Contexto
1. Na indexacao, coluna Telefone aparecia como `FoneFoneFone…`
2. Pedido: na etapa Distribuicao, campo **Agendamento Contato** com date picker

## Causa (header)
Parser de `sharedStrings` juntava `<t>` inclusive de `rPh`/runs de forma ruim; alem disso, falta sanitizacao de cabecalhos repetidos.

## Solucao
- `excel-headers.ts`: decode XML, colapsa token repetido, unicidade
- `xlsx-zip-stream.ts`: parse de sharedStrings ignora `rPh`; normaliza headers
- `parse-excel.ts`: normaliza headers no caminho client (SheetJS)
- Distribuicao: `Agendamento Contato` (DatePicker) no `LeadDistributionForm`
- Import (client + server job) e criacao manual aplicam `saveClientSchedulesBulk`

## Validacao
- collapse `FoneFone…Fi` → `Fone`
- Reiniciar fluxo de importacao (reler o Excel) para ver header correto
