# LOG — 2026-06-10 — indexação, campos endereço, cancelar import

## Pedidos
- Select de colunas A–Z na indexação
- Remover Endereço completo; adicionar campos de endereço separados + Tempo de Empresa
- Coluna mapeada sai do select; ao desmarcar volta
- Cancelar importação em qualquer estágio (mantém registros já gravados)

## Alterações
- `client-fields.ts`: novos ids endereço + `tempo_empresa`; migração legado
- `settings-defaults.ts`: `migrateFieldIdList` para produtos salvos
- `client-import-wizard.tsx`: headers ordenados, `headersForField`, cancel upload/import
- `client-import-progress.tsx`: botão Cancelar importação
- `import-job.*`: status `cancelled`, `cancelImportJobFn`, abort entre lotes
- `product-fields.ts`: campos do produto ordenados A–Z por label

## Validação
- `bun run build` OK
