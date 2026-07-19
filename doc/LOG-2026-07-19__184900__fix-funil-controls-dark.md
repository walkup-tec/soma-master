# Fix controles zoom React Flow (tema dark)

**Data:** 2026-07-19  
**Contexto:** Controles de zoom no canto inferior esquerdo do funil ficavam bloco branco com ícones invisíveis no dark.

## Solução

- CSS em `styles.css` para `.react-flow__controls-button` usar `--card` / `--foreground` / `--border`.
- `Controls` e `MiniMap` com classes de tema no canvas.

## Arquivos

- `src/styles.css`
- `src/components/marketing/funnel/funnel-builder-canvas.tsx`

## Palavras-chave

`react-flow-controls`, `funil-zoom`, `dark-theme`
