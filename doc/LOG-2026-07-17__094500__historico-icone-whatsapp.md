# LOG — Ícone WhatsApp no histórico

## Contexto

Registros originados no chat eram exibidos no histórico com o prefixo textual `[WhatsApp]`. O pedido é exibir o ícone verde do WhatsApp no lugar desse texto.

## Alteração

- `src/components/clients/client-attendance-dialog.tsx`
  - Detecta o prefixo legado `[WhatsApp]` sem diferenciar maiúsculas/minúsculas.
  - Remove o prefixo apenas na apresentação.
  - Renderiza ícone vetorial verde (`#25D366`) com `aria-label="Origem WhatsApp"`.

## Compatibilidade

O marcador continua armazenado na nota para preservar a origem e evitar migração de dados. Registros existentes e novos ganham o ícone automaticamente.

## Validação

- Lint sem erros.
- Pendente: commit/deploy.

## Palavras-chave

`histórico`, `WhatsApp icon`, `[WhatsApp]`, `origem atendimento`
