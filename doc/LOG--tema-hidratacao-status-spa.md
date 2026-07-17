# LOG — Tema escuro perdido apos Atualizar status

## Causa raiz
1. POST form → 303 full reload → bootstrap aplica `dark` → React hidrata `<html>` sem class e **remove** `dark`
2. Toggle duplo bootstrap+React podia cancelar clique

## Fix (commit a873ac3)
- SomaThemeRehydrate (useLayoutEffect)
- Bootstrap reaplica ~500ms + cookie `soma-theme`
- Toggle so no bootstrap; AppTopbar so espelha icone
- Atualizar status / QR via server fn (SPA, sem reload)

## Validar
Redeploy Easypanel → dark → Atualizar status → permanece dark; botao mostra Atualizando… sem overlay de pagina inteira
