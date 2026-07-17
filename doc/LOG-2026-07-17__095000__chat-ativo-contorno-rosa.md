# LOG — Conversa ativa com contorno rosa

## Contexto

No modo escuro, a conversa selecionada na lista usava fundo rosa/roxo preenchido, prejudicando a leitura. Pedido: indicar a conversa ativa apenas com contorno rosa.

## Alteração

- `src/components/chat/chat-inbox-screen.tsx`
  - Todos os itens recebem borda transparente para evitar mudança de tamanho.
  - Item ativo usa `border-primary`, fundo transparente e hover transparente.
  - Remove o antigo `bg-primary-soft`.

## Validação

- Lint sem erros.
- Pendente: validação visual e commit/deploy.

## Palavras-chave

`chat ativo`, `contorno rosa`, `dark mode`, `bg-primary-soft`
