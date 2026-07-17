# LOG — Download de anexo do WhatsApp em "formato estranho" (sem extensão)

**Data:** 2026-07-17 13:55
**Contexto:** Ao clicar em baixar (modal de detalhes do cliente) uma imagem recebida pelo WhatsApp, o arquivo baixava em formato estranho.

## Causa raiz

A mídia inbound do WhatsApp era salva com `fileName` padrão **sem extensão** (`imagem-recebida`). Ao anexar ao cliente e baixar, o `content-disposition` usava esse nome sem `.jpg`/`.png`, então o Windows salvava um arquivo sem extensão que ele não sabe abrir ("formato estranho"). O MIME correto existia no banco, mas o nome do arquivo não refletia isso.

## Solução

Novo helper `src/lib/files/file-name-extension.ts` — `ensureFileNameExtension(fileName, mimeType)` acrescenta a extensão correta (`jpg`/`jpeg`, `png`, `webp`, `pdf`) quando ausente ou divergente do MIME. Aplicado em 3 pontos:

1. **`client-attachment-download.handler.ts`** — no download do anexo (corrige inclusive anexos antigos já gravados sem extensão, pois o nome é corrigido na hora de servir).
2. **`chat-media.repository.ts` (`saveInboundChatMedia`)** — raiz: mídia inbound nova já é salva com extensão coerente com o MIME.
3. **`client-attachment.repository.ts` (`createClientAttachmentFromChatMedia`)** — cópia chat → anexo garante extensão (cobre mídias antigas do chat).
4. **`routes/api/chat/media.$mediaId.ts`** — filename do `content-disposition: inline` também corrigido ("Salvar como" a partir da aba aberta).

## Arquivos alterados

- `src/lib/files/file-name-extension.ts` (novo)
- `src/lib/clients/client-attachment-download.handler.ts`
- `src/lib/chat/chat-media.repository.ts`
- `src/lib/clients/client-attachment.repository.ts`
- `src/routes/api/chat/media.$mediaId.ts`

## Validação

- `npm run build` → OK (29.7s).
- Typecheck: sem erros novos nos arquivos alterados (erros pré-existentes de tipagem de sessão permanecem, não bloqueiam build).
- Pós-deploy: baixar "imagem-recebida" no modal de detalhes → deve salvar como `imagem-recebida.jpg` e abrir normalmente.

## Segurança

- Sem segredos expostos; helper puro sem I/O.

## Palavras-chave

download anexo sem extensão, formato estranho, content-disposition filename, imagem-recebida, ensureFileNameExtension, mime extension
