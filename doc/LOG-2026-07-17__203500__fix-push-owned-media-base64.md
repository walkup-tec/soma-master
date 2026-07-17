# LOG — Push comunidade: Owned media must be a url or base64

## Contexto

Push Parcial com imagem na comunidade:

`Evolution HTTP 400: Owned media must be a url or base64`

Mesmo problema tratado no WABA (`doc/LOG-2026-06-30__push-comunidade-imagem-tls-base64-fix.md` e commit com variantes base64).

## Causa

A Evolution valida `media` com `class-validator` (`isBase64` / `isURL`).  
Data URI `data:image/...;base64,...` **não passa** em nenhum dos dois → 400 “Owned media…”.

Soma enviava só data URI.

## Correção (espelho WABA)

1. **Variantes** — base64 **puro primeiro**, depois data URI (`buildEvolutionMediaVariants`).
2. **Fallback URL** — `http://172.17.0.1:30300/api/push/media/:id` + `APP_URL` + `SOMA_PUSH_MEDIA_INTERNAL_BASE_URL`.
3. **Timeout** sendMedia 60s.
4. Se a imagem ainda falhar e houver texto → envia texto à comunidade (não deixa só “Parcial” sem mensagem).

## Arquivos

- `src/lib/chat/evolution.adapter.ts`
- `src/lib/push/push-community.service.ts`

## Validar

1. Push com imagem + comunidade → enviado (não Parcial por Owned media).
2. Sem imagem → texto continua OK.

## Keywords

`Owned media`, `base64 puro`, `sendMedia`, `push comunidade`, WABA tls-base64
