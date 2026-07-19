# LOG — Transferir chat WhatsApp

**Data:** 2026-07-19 12:04:12  
**Repo:** Soma

## Pedido

Transferir atendimento para outro usuário. Ao transferir, o chat sai de **Meus**, **Não atribuídos** e **Todos** do remetente; no destinatário fica em **Meus** (atribuído).

## UI

Botão **Transferir** no header do thread (ao lado de Atribuir / Remover). Abre modal com busca de usuários que têm menu Chat.

## Backend

- `transferConversation` — atribui ao destino, +1 unread, mensagem de sistema
- `listChatTransferTargetsFn` — usuários com acesso ao Chat (exceto o atual)
- `transferChatConversationFn`

## Filtro Todos

Para agente comum: **Todos** = não atribuídos + meus (fila operacional).  
Assim, após transferir, some também de Todos.  
Master continua vendo tudo em Todos.

## Arquivos

- `src/components/chat/chat-transfer-dialog.tsx` (novo)
- `src/components/chat/chat-inbox-screen.tsx`
- `src/lib/chat/chat.repository.ts`
- `src/lib/chat/chat.server.ts`

## Validar

1. Em Meus → Transferir → escolher colega → some da sua lista.
2. No login do colega → aparece em Meus, atribuído a ele, com unread.
3. Não aparece em Não atribuídos.
