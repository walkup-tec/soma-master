# LOG — Margem entre título e campo no modal de atendimento

## Contexto

Os títulos `Status de atendimento` e `Registrar atendimento` estavam visualmente colados aos respectivos campos.

## Alteração

- `src/components/clients/client-attendance-dialog.tsx`
  - Espaçamento vertical dos dois grupos aumentado de `space-y-2` para `space-y-3`.

## Validação

- Lint sem erros.
- Pendente: commit/deploy.

## Palavras-chave

`label input`, `margem inferior`, `modal atendimento`, `space-y-3`
