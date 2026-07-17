# LOG — Envio e recebimento de imagens no WhatsApp

## Contexto

O Inbox WhatsApp do Soma suportava apenas texto. Pedido: enviar e receber imagens diretamente na conversa.

## Documentação oficial estudada

- Evolution API v2 — Send Media: https://doc.evolution-api.com/v2/api-reference/message-controller/send-media
- Evolution API v2 — Get Base64: https://doc.evolution-api.com/v2/api-reference/chat-controller/get-base64
- Evolution API v2 — Webhooks: https://doc.evolution-api.com/v2/api-reference/webhook/set

Contratos usados:

- `POST /message/sendMedia/{instance}`: `number`, `mediatype=image`, `mimetype`, `media` (data URL base64), `fileName`, `caption`.
- Webhook `MESSAGES_UPSERT` com `base64=true`.
- Fallback: `POST /chat/getBase64FromMediaMessage/{instance}` quando o webhook não trouxer base64.

## Solução

### Interface

- Botão de imagem (`ImagePlus`) ao lado do campo de mensagem.
- Aceita JPG, PNG e WEBP, até 10 MB.
- Prévia local, remoção e legenda opcional.
- Upload otimista em chunks de 1 MiB.
- Balões exibem imagens enviadas e recebidas com lazy loading.

### Servidor / Evolution

- Novas server functions: iniciar upload, anexar chunk, finalizar e enviar.
- Envio manual de imagem atribui atendente e pausa a IA da conversa (mesma regra do texto).
- Adapter `evolutionSendImage` isolado da regra de negócio.
- Adapter `evolutionGetMediaBase64` para fallback no recebimento.
- Webhook atualizado para extrair `imageMessage`, caption, MIME e base64; dedupe por `waMessageId` antes de salvar/reprocessar IA.
- Instâncias existentes têm webhook reaplicado com `base64=true`.

### Persistência e segurança

- Nova tabela `crm.chat_media` guarda conteúdo `bytea` separado da listagem de mensagens.
- `crm.chat_messages` recebe `message_type`, `media_id`, `media_mime_type`, `media_file_name`.
- Arquivo também é salvo em `/app/data/chat-media` como cache/fallback local.
- Rota autenticada `GET /api/chat/media/:mediaId` exige sessão com acesso ao menu Chat.
- IDs não previsíveis, MIME allowlist, limite 10 MB, validação de chunks e `nosniff`.
- Binário não entra nas queries normais de conversa/mensagens, evitando degradação.

## Arquivos principais

- `src/lib/chat/chat-media.constants.ts`
- `src/lib/chat/chat-media.repository.ts`
- `src/routes/api/chat/media.$mediaId.ts`
- `src/lib/chat/evolution.adapter.ts`
- `src/lib/chat/webhook.handler.ts`
- `src/lib/chat/chat.server.ts`
- `src/lib/chat/chat.repository.ts`
- `src/lib/chat/ensure-chat-schema.ts`
- `src/lib/chat/chat.types.ts`
- `src/components/chat/chat-inbox-screen.tsx`

## Validação

- `npm run build`: sucesso (client + SSR + route tree).
- IDE lint: sem erros.
- Build demorou ~14 min no Drive local, mas concluiu com exit code 0.
- Pendente pós-deploy: enviar JPG com/sem legenda e receber JPG/PNG real pela instância `soma-*`.

## Observações

- IA recebe texto substituto quando a imagem chega sem legenda; não há visão computacional nesta entrega.
- Nenhum segredo foi adicionado ou logado.

## Palavras-chave

`Evolution sendMedia`, `imageMessage`, `getBase64FromMediaMessage`, `chat_media`, `WhatsApp imagens`, `upload chunks`
