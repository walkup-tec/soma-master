# LOG — Cabeçalho Contato espelha nome/WhatsApp do formulário

## Contexto

No painel "Vincular ao CRM" do chat, ao editar os campos Nome e WhatsApp, o cabeçalho "Contato" (nome + telefone no topo do cartão) deve refletir os valores digitados em tempo real.

## Alterações

- `src/components/chat/chat-contact-panel.tsx`
  - Nova prop opcional `onDraftChange({ name, phone })`, emitida quando `fields.nome` / `fields.whatsapp` (fallback `telefone`) mudam.
- `src/components/chat/chat-inbox-screen.tsx`
  - Novo estado `contactDraft`; cabeçalho usa `contactDraft.name || clientName || contactName` e `contactDraft.phone || phone`.
  - Rascunho zera ao trocar de conversa (`openConversation`) e após vincular (`onUpdated`).

## Comportamento

- Digitou Nome/WhatsApp no formulário → topo atualiza na hora.
- Sem produto selecionado ou campos vazios → topo volta aos dados da conversa.
- Após vincular, o nome passa a vir do cliente CRM (`clientName`, join com `crm.clients`); o telefone da conversa (chave do WhatsApp real) não é alterado no banco.

## Validação

- Lint sem erros. Alterações não commitadas.

## Palavras-chave

`chat contato header`, `onDraftChange`, `vincular ao CRM`, `contactDraft`
