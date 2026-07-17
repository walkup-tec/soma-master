# LOG — Exclusão do parceiro mozart.hotmart@gmail.com

**Data:** 2026-07-17 18:30

## Pedido

Excluir o parceiro `mozart.hotmart@gmail.com` do sistema.

## Execução

- Script: `scripts/delete-partner-by-email.ts`
- Removido do Postgres: usuário, `partner_profiles`, permissões, bancos e eventos.
- Resultado:
  - e-mail: `mozart.hotmart@gmail.com`
  - nome: MMS MARKETING E SISTEMAS DIGITAIS LTDA
  - id: `partner-e44402a5-44d5-4a25-89d0-d7731e17881e`
- Revalidação: e-mail não encontrado no banco.

## Uso do script

```bash
bun run scripts/delete-partner-by-email.ts email@dominio.com
```

Bloqueia exclusão se houver filhos na hierarquia ou se for conta master.

## Keywords

excluir parceiro, delete-partner-by-email, mozart.hotmart
