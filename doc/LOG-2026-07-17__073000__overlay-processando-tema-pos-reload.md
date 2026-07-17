# LOG — Overlay Processando + tema escuro pós-reload

**Data:** 2026-07-17 ~07:30

## Pedido

Botões que recarregam (ex.: Atualizar status EVO) sem feedback; após reload o tema voltava ao claro.

## Solução

1. Bootstrap global `SOMA_PROCESSING_BOOTSTRAP_SCRIPT` — overlay “Processando…” em todo `form method=post` (exceto `data-no-processing`).
2. Labels nos forms EVO/IA (`data-processing-label`).
3. Tema: script no `<head>` **antes** do CSS; reaplicar em `pageshow` / `DOMContentLoaded`.

## Arquivos

- `src/lib/ui/processing-overlay.ts`
- `src/lib/theme/soma-theme.ts`
- `src/routes/__root.tsx`
- `src/styles.css`
- `chatbot-settings.tsx`, `chat-ai-education-screen.tsx`
