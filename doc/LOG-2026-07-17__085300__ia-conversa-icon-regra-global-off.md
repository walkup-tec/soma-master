# LOG — IA da conversa com ícone + regra global off

## Contexto

1. O toggle de IA dentro do chat individual mostrava texto `IA on/off`.
2. Nova regra: desligar a IA geral também desliga a IA de qualquer conversa individual.

## Alterações

- `src/components/chat/chat-inbox-screen.tsx`
  - Botão da conversa: só ícone `Sparkles`; verde quando ligado, contorno neutro quando desligado (mesmo padrão do global).
  - Ao desligar a IA global, o front zera `aiEnabled` das conversas e da conversa ativa.
- `src/lib/chat/chat.repository.ts`
  - Nova `disableAiForAllConversations()` (Postgres + fallback JSON).
- `src/lib/chat/chat.server.ts`
  - `setChatAiGlobalEnabledFn`: quando `enabled=false`, chama `disableAiForAllConversations()`.

## Validação

- Lint sem erros.
- Pendente pós-deploy: desligar IA global e conferir que conversas com IA ligada ficam pausadas (badge e painel do contato).

## Retomada

- Alterações não commitadas; aguardar pedido de commit/push.

## Palavras-chave

`Sparkles`, `IA conversa`, `disableAiForAllConversations`, `IA global off`
