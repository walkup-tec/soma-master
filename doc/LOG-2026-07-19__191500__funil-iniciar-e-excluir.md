# Funil: módulo Iniciar na palette + excluir na lista

**Data:** 2026-07-19  
**Pedido:** Iniciar (imediato/agendado) visível no funil; botão Excluir na listagem.

## Solução

- `FUNNEL_STEP_CATALOG` inclui **Iniciar**; só um por funil; não removível.
- `ensureFunnelHasStart` ao abrir/salvar/ler storage.
- Listagem: Editar + Excluir (confirm).

## Arquivos

- `funnel.types.ts`, `funnel-builder-canvas.tsx`, `funnel-builder-modal.tsx`, `marketing-panels.tsx`

## Palavras-chave

`funil-iniciar`, `funil-excluir`, `ensureFunnelHasStart`
