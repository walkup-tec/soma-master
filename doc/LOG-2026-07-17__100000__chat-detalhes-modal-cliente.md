# LOG — "Detalhes" no chat abre o modal do cliente

## Contexto

No cartão Contato do chat (conversa vinculada), o link "Abrir no CRM" só navegava para a lista de clientes. Pedido: trocar por "Detalhes", abrindo o mesmo modal da tela Clientes (dados + histórico + status + anexos).

## Alteração

- `src/components/chat/chat-contact-panel.tsx`
  - Substitui o `Link` "Abrir no CRM" por botão "Detalhes" (ícone `IdCard`).
  - Renderiza `ClientAttendanceDialog` (o mesmo modal da tela Clientes) com `clientId` da conversa.
  - `onStatusChange` dispara `onUpdated` → o inbox atualiza lista/conversa (status novo aparece no poll).

## Validação

- Lint sem erros; `IdCard` presente no lucide-react 0.575.
- Pendente: commit/deploy.

## Palavras-chave

`chat detalhes`, `ClientAttendanceDialog`, `abrir no CRM`, `modal cliente`
