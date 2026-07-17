# LOG — Card do chat: contato, produtos, status e IA

**Data:** 2026-07-17 13:38

## Contexto

Simplificar e reorganizar os cards da lista de conversas, mostrando somente as informações úteis para triagem: nome do contato, controle da IA, todos os produtos e status.

## Solução

- Topo com nome do contato, contador de não lidas e ícone `Sparkles` da IA.
- Ícone da IA é interativo: colorido quando ativo, neutro quando pausado, com loading, tooltip e `aria-pressed`.
- Todos os produtos vinculados aparecem em tags com as cores configuradas.
- Divisor fino separa produtos do status.
- Status aparece em uma seção própria.
- Removidos do card: atendente atribuído e prévia da última mensagem.
- Card ganhou espaçamento vertical consistente, cantos arredondados e foco visível por teclado.
- O toggle da IA foi centralizado em `toggleConversationAi`, mantendo card e cabeçalho sincronizados.

## Arquivo alterado

- `src/components/chat/chat-inbox-screen.tsx`

## Validação

- `npm run build`: OK (client + SSR).
- Fluxos para validar visualmente: card com um produto, múltiplos produtos, sem produto, com/sem status e IA ativa/pausada.

## Segurança

- Nenhuma alteração de autenticação ou dados.
- Toggle continua usando a server function autenticada existente.

## Palavras-chave

chat card, lista conversas, produtos, status, Sparkles IA, toggle IA
