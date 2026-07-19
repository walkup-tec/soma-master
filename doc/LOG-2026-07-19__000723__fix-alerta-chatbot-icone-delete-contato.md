# LOG — Fix alerta Chatbot + ícone + exclusão contato teste

## Contato apagado (produção DB)
- Telefone: `51999666841` → `5551999666841`
- Conversa `chat-5fa32b98-5` (“Contato teste”) removida com 2 mensagens
- Script: `scripts/delete-chat-contact-by-phone.ts`

## Por que o alerta não disparou
A conversa já estava com `assigned_user_id = master-mozart` e `unread = 0`
(abrir o chat atribui atendente e zera unread). O filtro antigo exigia
`unread > 0 && !assigned` → nunca acendia.

## Correções
1. Alerta por `unread > 0` (sem filtrar assigned)
2. Detecta **novo ID de conversa** na lista → chime + hold visual ~45s
3. Poll a cada 3s
4. Ícone: marca WhatsApp sólida `currentColor` (legível em 18px)

## Como testar
1. Ficar em Dashboard (não abrir Chat)
2. Mandar WhatsApp de `51999666841`
3. Esperar até ~3s: ícone verde + som + destaque no menu

## Keywords
chatbot, alerta, whatsapp icon, delete contact, unread
