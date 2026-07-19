# LOG — Reduzir delay chat WhatsApp (envio/recebimento)

**Data:** 2026-07-19 11:31:58  
**Repo:** Soma  
**Contexto:** Mensagens demoravam a aparecer no inbox após o contato enviar (e envio aguardava Evolution).

## Causa

1. **Recebimento:** UI fazia poll a cada **5s** e em **série** (lista → depois thread) → atraso até ~5s+ latência de API após o webhook já ter gravado.
2. **Envio texto:** `sendChatMessageFn` **esperava** `evolutionSendText` (até 20s) antes de liberar a resposta — botão “enviando” preso; WhatsApp podia atrasar confirmação.
3. **Webhook:** em cada inbound, `listMessages` completo só para dedupe (já feito em `appendMessage` por `wa_message_id`).

## Solução

| Área | Mudança |
|------|---------|
| Thread aberto | Poll **1,2s** (só `getThread`), paralelo à lista |
| Lista | Poll **3s**, independente |
| Aba em foco | Refresh imediato em `focus` / `visibilitychange` |
| Envio texto | Evolution em **background** (igual imagem); falha → aviso sistema no thread |
| Webhook | Remove `listMessages` de dedupe |
| sendText | Timeout 20s → **12s** (falha mais rápida no background) |

## Arquivos

- `src/components/chat/chat-inbox-screen.tsx`
- `src/lib/chat/chat.server.ts`
- `src/lib/chat/webhook.handler.ts`
- `src/lib/chat/evolution.adapter.ts`

## Validar

1. Com conversa aberta, enviar do celular → aparece em ~1–2s.
2. Enviar do CRM → bolha imediata; WhatsApp recebe sem travar o composer.
3. Se Evolution cair, aviso de sistema no thread no próximo poll.

## Limite

Latência residual = webhook EVO → Soma + até 1,2s de poll. Push (SSE/WebSocket) seria o próximo passo se precisar &lt;300ms.
