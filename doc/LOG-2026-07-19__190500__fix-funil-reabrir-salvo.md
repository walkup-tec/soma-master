# Fix reabrir funil perdido / só Fim

**Data:** 2026-07-19  
**Sintoma:** Salvar → fechar → Editar mostrava fluxo só com módulo Fim (ou não batia com o gravado).

## Causas

1. Canvas React Flow não sincronizava o grafo no `draft` pai em todo change estrutural; Salvar podia gravar estado velho.
2. `useEffect` com `loadSettings`/`initialDraft` podia resetar o draft no meio da sessão.
3. Reabrir usava objeto em memória em vez de reler o `localStorage` pelo id.

## Fix

- Persistência do grafo via `applyNodeChanges` / refs (add/remove/position end).
- Load só no `justOpened`; `getStoredFunnelById` + `normalizeFunnelDraft`.
- Delete só com tecla Delete (não Backspace).
- Contador de etapas no header ao salvar.

## Palavras-chave

`funil-save-load`, `localStorage`, `react-flow-persist`
