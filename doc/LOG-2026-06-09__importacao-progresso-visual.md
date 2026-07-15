# LOG — 2026-06-09 — Progresso visual na importação

## Contexto
- Planilha local: `planilha teste clientes inss.xlsx` (~165 MB / 173397298 bytes)
- Usuário pediu indicador visual de andamento no modal de importação

## Implementado
- `client-import-progress.tsx` — overlay com barra, fase e contador
- Leitura da planilha: overlay "Lendo planilha" com fases (carregar → interpretar → converter)
- Importação final: lotes de 50 linhas com progresso real (X de Y clientes)
- Prévia das primeiras 5 linhas na etapa Arquivo
- Aviso para arquivos grandes (> 20 MB)
- `batchId` reutilizado entre lotes no mesmo import
- Bloqueio de fechar modal durante processamento

## Planilha INSS
- Arquivo muito grande; leitura no Node levou ~8+ min só para abrir workbook
- Recomendação: exportar subset menor ou CSV enxuto para testes no browser

## Validação
- `bun run build` — OK
