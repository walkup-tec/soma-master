# Fix modais Público/Disparo atrás do construtor

**Data:** 2026-07-19  
**Causa:** FunnelBuilderModal `z-[100]`; Dialog Radix `z-50` → modal abria invisível atrás.  
**Fix:** `overlayClassName` + `z-[200]` nos modais; Escape do builder ignora dialog Radix aberto.

## Arquivos
- `src/components/ui/dialog.tsx`
- `funnel-audience-modal.tsx`, `funnel-disparo-modal.tsx`, `funnel-builder-modal.tsx`

## Palavras-chave
`funil-modal-zindex`, `dialog-overlayClassName`
