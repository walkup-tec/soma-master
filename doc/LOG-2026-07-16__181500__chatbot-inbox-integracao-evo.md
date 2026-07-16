# LOG — Chatbot funcional + Integração EVO unificada

## Contexto

Inbox vazia (“configure webhook”); configs espalhadas; pedido de layout BotConversa/Chatwoot e **toda parametrização na Integração EVO**.

## Referências

- Chatwoot: 4 regiões — lista (Mine/Unassigned/All) | thread | cartão contato  
  https://www.chatwoot.com/hc/user-guide/articles/1677231493-lesson-2-dashboard-basics
- BotConversa: bate-papo + cartão do usuário + conexão QR

## Implementado

1. **Configurações → Integração EVO** (aba ChatBot renomeada): conexão QR + webhook URL + aplicar na EVO + teste inbound local + educação IA
2. **Inbox** estilo Chatwoot: filtros Meus/Não atribuídos/Todos, busca, thread com Responder/Nota, painel contato (xl+)
3. Poll 10s; CTA para Integração EVO; `/app/chat/ia` redireciona para Config
4. `webhook_public_base_url` em `chat_ai_settings`; `getResolvedWebhookUrl`

## Como validar

1. Config → Integração EVO → Gerar QR / conectar
2. Seção Webhook → teste local “Enviar teste → Inbox”
3. Chat WhatsApp → conversa aparece; responder; Assumir

## Keywords

chatbot, chatwoot, botconversa, integracao-evo, webhook, inbox, mine-unassigned-all
