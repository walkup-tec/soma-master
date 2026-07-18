# LOG — Exportar Excel na seleção de clientes (WhatsApp EVO)

## Contexto
- Não importar Waba Aquecedor / API Alternativa (muito escopo).
- No modal de ações pós-seleção de clientes: opção **Exportar Excel** com todos os dados dos selecionados.
- Coluna WhatsApp no formato Evolution (só dígitos + DDI 55).

## Solução
1. `client-export-excel.ts` — monta XLSX; `formatWhatsAppForEvo` via `normalizeWhatsAppPhone`; coluna WhatsApp como texto (`t:'s'`, `z:'@'`); fallback Telefone se WhatsApp vazio.
2. `listClientsForBulkExport` no repository — carrega id/status/produto/created_at/data do escopo (IDs ou filtro).
3. `exportBulkClientsExcelFn` — retorna `{ fileName, mimeType, base64, total }`.
4. Modal: ação **Exportar Excel** + botão **Baixar Excel** (download blob).

## Arquivos
- `src/lib/clients/client-export-excel.ts` (novo)
- `src/lib/clients/client-bulk.repository.ts`
- `src/lib/clients/clients.server.ts`
- `src/components/clients/client-bulk-actions-modal.tsx`

## Validação
- `formatWhatsAppForEvo('(11) 98765-4321')` → `5511987654321`
- Menu Funil/Aquecedor não permanece (revertido a pedido).

## Keywords
export, excel, xlsx, bulk, clientes, whatsapp, evo, evolution, DDI 55
