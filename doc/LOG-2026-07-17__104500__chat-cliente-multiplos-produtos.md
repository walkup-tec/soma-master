# LOG — Adicionar múltiplos produtos ao cliente pelo chat

## Contexto

Após vincular uma conversa a um cliente, o painel lateral mostrava apenas status e detalhes. Um cliente pode possuir mais de um produto e precisa poder adicionar produtos extras sem duplicar o cadastro.

## Alterações

- `src/lib/clients/client.types.ts`
  - `ClientRecord.productIds?` para fallback local.
- `src/lib/clients/clients.repository.ts`
  - Nova `addProductToClient(clientId, userId, isMaster, productId)`.
  - Valida acesso ao cliente e existência do produto.
  - Persiste produto principal + extra em `crm.client_products` com `on conflict do nothing`.
  - Fallback JSON preserva lista sem duplicatas.
- `src/lib/chat/chat.types.ts`
  - `ChatConversation.clientProductIds`.
- `src/lib/chat/chat.repository.ts`
  - Conversas vinculadas são enriquecidas com produto principal + extras.
- `src/lib/chat/chat.server.ts`
  - Nova `addChatClientProductFn`, autenticada e autorizada.
  - Bloqueia duplicata e registra histórico `[WhatsApp] Produto adicionado: ...`.
  - Respostas da Evolution nas server functions foram saneadas para `{ok,error}` (remove `raw: unknown` não serializável).
- `src/components/chat/chat-contact-panel.tsx`
  - Mostra produtos atuais como tags coloridas.
  - Select lista apenas produtos ainda não vinculados.
  - Botão `+` adiciona produto e atualiza o painel.

## Validação

- IDE lint: sem erros.
- TypeScript: nenhum erro novo nos arquivos alterados.
- O `tsc` completo ainda retorna erros históricos de tipagem de sessão/crypto fora deste escopo.

## Segurança

- Acesso ao cliente validado por `getClientByIdForUser`.
- Produto validado no banco/configuração.
- Sem duplicação de cliente ou relação produto.

## Palavras-chave

`cliente multi-produto`, `client_products`, `addChatClientProductFn`, `Produtos do cliente`
