# LOG — Chat WhatsApp: scroll, alertas, atribuir

**Data:** 2026-07-19 11:21:55  
**Repo:** Soma (`walkup-tec/soma-master`)  
**Contexto:** Ajustes de UX do Inbox WhatsApp (scroll, alertas topbar/menu, som, atribuição explícita).

## Pedido

1. Auto-scroll para a última mensagem (enviada ou recebida).
2. Ícone WhatsApp no topo: só contato **novo**.
3. Menu lateral Chat: sinal a cada **mensagem recebida** (mesmo contato existente).
4. Som nas duas situações (msg nova + contato novo).
5. Sem alerta/som se o usuário já está naquela conversa.
6. Botão **Atribuir** → coluna Meus; Não atribuídos / Todos mantidos.

## Solução

### Alertas (`chatbot-alert-context.tsx` + `getChatbotIncomingAlertFn`)
- Separou `newContactActive` (topbar) vs `unreadMessageActive` (sidebar).
- API devolve `unreadByConversationId` + `allConversationIds`.
- Chime quando: ID novo aparece **ou** unread de alguma conversa sobe.
- `setViewingConversationId` silencia alertas/som da conversa aberta.
- Hold ~45s no pulso de contato novo no topbar.

### Inbox (`chat-inbox-screen.tsx`)
- Abrir conversa **não** chama mais `joinChat` (só `getThread` + mark read).
- Botão **Atribuir** chama `joinChatConversationFn` → aparece em Meus.
- Sem auto-selecionar a primeira conversa ao entrar.
- `messagesEndRef` + `scrollIntoView` ao mudar `messages`.
- Poll do thread ativo a cada 5s.

### UI
- Topbar: `newContactActive`.
- Sidebar: `unreadMessageActive`.

## Arquivos

- `src/components/chat/chatbot-alert-context.tsx`
- `src/components/chat/chatbot-topbar-icon.tsx`
- `src/components/chat/chat-inbox-screen.tsx`
- `src/components/app-sidebar.tsx`
- `src/lib/chat/chat.server.ts`

## Validar

1. Abrir Inbox sem conversa pré-selecionada.
2. Enviar/receber msg → thread rola até o fim.
3. Contato novo (fora do chat) → pulso topbar + som; menu também se houver unread.
4. Msg de contato existente (fora do chat) → menu + som; **sem** pulso topbar.
5. Com a conversa aberta → sem som/alerta daquele contato.
6. **Atribuir** → some de Não atribuídos; entra em Meus.

## Observações

- Enviar mensagem ainda atribui automaticamente (atendimento ativo) — comportamento do `sendChatMessageFn`.
- `package-lock.json` untracked local não foi commitado (gerado por acidente no checkpoint).
