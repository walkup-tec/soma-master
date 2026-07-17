# LOG — Envio de imagem no chat lento (otimização)

**Data:** 2026-07-17 11:05
**Contexto:** Usuário reportou que enviar imagem pelo chat demora muito, enquanto receber é rápido.

## Causa raiz (3 gargalos no fluxo de envio)

1. **Chunks em série** — `readFileInChunks` subia até 10 partes de 1 MiB uma por vez (10 roundtrips sequenciais).
2. **Bytea bloqueante** — `finalizeChatImageUpload` gravava o binário (até 10 MB) no Postgres/Supabase remoto **antes** de responder.
3. **Releitura do banco + Evolution síncrona** — `readChatImageAsDataUrl` preferia o banco (baixava os 10 MB de volta) e o handler esperava `evolutionSendImage` (timeout 30s) para só então responder à UI.

O recebimento é rápido porque a imagem chega pronta no webhook.

## Solução implementada

| Arquivo | Mudança |
|---|---|
| `src/lib/clients/upload-file-chunks.ts` | Nova `readFileInChunksParallel(file, chunkSize, concurrency, onChunk)` — pool de workers |
| `src/components/chat/chat-inbox-screen.tsx` | Usa upload paralelo com concorrência 4 |
| `src/lib/chat/chat-media.repository.ts` | `appendChatImageChunk`: não reescreve mais `meta.json` (evita corrupção com escrita concorrente) e usa `greatest()` no update de `received_chunks`; `finalizeChatImageUpload`: reconta chunks do disco e persiste o bytea no banco **em background** (`persistChatImageContentToDatabase`); `readChatImageAsDataUrl` e `openChatImageReadStream`: disco local primeiro, banco só como fallback |
| `src/lib/chat/chat.server.ts` | `finalizeAndSendChatImageFn`: envio Evolution movido para background (`sendChatImageViaEvolutionInBackground`); responde à UI assim que a mensagem persiste; falha na Evolution vira mensagem de sistema no thread ("⚠️ …não foi entregue no WhatsApp…"), visível via polling |

## Comportamento novo

- UI libera em ~1–3s (antes: upload serial + 10 MB pro banco + 10 MB de volta + espera Evolution).
- Se a Evolution falhar, o atendente vê mensagem de sistema no thread em até 10s (poll) em vez do toast síncrono.
- O binário continua indo para o banco (durabilidade pós-redeploy), só que sem bloquear a resposta.

## Validação

- `npm run build` → OK (exit 0).
- Erros do `tsc --noEmit` são pré-existentes (tipos de sessão), não relacionados.
- Teste real: enviar imagem grande (~8–10 MB) pelo chat e confirmar que a bolha sai do estado "enviando" rápido e a imagem chega no WhatsApp.

## Pendências

- Commit/deploy ainda não feitos (aguardando ordem do usuário; há outras alterações pendentes na árvore: múltiplos produtos no painel do cliente, label margem).

**Palavras-chave:** chat imagem lenta, upload paralelo chunks, bytea background, readChatImageAsDataUrl local-first, evolution sendMedia background
