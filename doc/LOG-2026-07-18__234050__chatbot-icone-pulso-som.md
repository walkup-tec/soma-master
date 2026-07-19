# LOG — Ícone WhatsApp topbar: pulso + som + destaque no menu

## Contexto
Ícone WhatsApp (só contorno) ao lado do sino, sem link para o chat.
Quando um novo contato chama no Chatbot: pulso verde, som discreto e destaque no menu Chat WhatsApp.

## Critério de alerta
Conversas com `unreadCount > 0` e sem `assignedUserId` (ainda no Chatbot, sem atendente).

## Solução
1. `getChatbotIncomingAlertFn` — poll a cada ~8s (aba visível).
2. `ChatbotAlertProvider` — chime Web Audio só quando entra ID novo (não no 1º load).
3. Topbar: ícone outline + ping/pulse emerald.
4. Sidebar Chat WhatsApp: fundo suave + ponto verde discreto.

## Arquivos
- `src/components/chat/chatbot-alert-context.tsx`
- `src/components/chat/whatsapp-outline-icon.tsx`
- `src/components/chat/chatbot-topbar-icon.tsx`
- `src/lib/chat/chat.server.ts`
- `src/routes/app.tsx`
- `src/components/app-topbar.tsx`
- `src/components/app-sidebar.tsx`

## Keywords
whatsapp, topbar, pulso, som, chatbot, alert, menu chat
