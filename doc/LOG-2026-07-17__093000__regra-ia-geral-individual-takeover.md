# LOG — Regra IA geral, individual e takeover manual

## Contexto

O usuário definiu a precedência dos controles do chatbot:

1. O botão geral aplica IA ligada/desligada a todas as conversas naquele momento.
2. Cada conversa pode ser ligada/desligada individualmente, mesmo se o estado geral estiver desligado.
3. Enviar mensagem manual sempre pausa a IA apenas daquela conversa.
4. Abrir a conversa atribui o atendente automaticamente, mas não pausa a IA.

## Alterações

- `src/lib/chat/chat.repository.ts`
  - `joinConversationAsAgent` agora só atribui o usuário e preserva `aiEnabled`.
  - `setAiEnabledForAllConversations(boolean)` substitui a operação apenas de desligar.
  - Conversas novas herdam o último estado geral.
- `src/lib/chat/chat.server.ts`
  - Toggle geral salva a configuração e aplica o estado a todas as conversas.
  - Envio manual atribui o atendente e grava `aiEnabled=false` antes de enviar.
  - Configuração da educação IA também aplica mudanças gerais em massa.
- `src/lib/chat/webhook.handler.ts`
  - O estado individual `conversation.aiEnabled` é soberano; não há bloqueio absoluto por `aiGlobalEnabled`.
  - A IA revalida o estado individual após gerar e antes de publicar, evitando resposta concorrente após takeover manual.
- `src/components/chat/chat-inbox-screen.tsx`
  - Abrir preserva a IA.
  - Toggle geral atualiza visualmente todas as conversas para o estado aplicado.
- `src/routes/api/settings/chatbot/education.ts`
  - O POST legado de configurações também aplica a ação geral em massa.
- `src/lib/chat/chat.types.ts`
  - Contrato documenta que `aiGlobalEnabled` representa o último comando geral, não um bloqueio absoluto.

## Matriz de comportamento

- Geral ON → todas ON; desligar uma → só ela OFF.
- Geral OFF → todas OFF; ligar uma → só ela ON.
- Mensagem manual em qualquer estado → conversa atual OFF.
- Abrir conversa → atribui usuário, mantém ON/OFF.
- Conversa nova → herda o último estado geral.

## Validação

- `npm run build`: sucesso (client + SSR).
- IDE lint: sem erros.
- Checagem de concorrência adicionada antes do envio da resposta IA.

## Segurança e retomada

- Nenhum segredo alterado.
- Alterações ainda não commitadas.
- Keywords: `IA geral`, `IA individual`, `takeover manual`, `aiEnabled`, `setAiEnabledForAllConversations`.
