# Campo Data ultima parcela

## Pedido
Em Editar produtos / Dados financeiros: adicionar `data ultima parcela` com mascara de data.

## Feito
- `client-fields.ts`: id `data_ultima_parcela` no grupo financeiros
- `date-mask.ts`: mascara `dd/mm/aaaa`
- `client-field-input.tsx`: mascara em `data_ultima_parcela` e `data_nascimento`
- Campo entra automaticamente em Configuracoes > Produtos (ALL_CLIENT_FIELD_IDS)

## Validacao
Configuracoes > Produtos > Dados financeiros deve listar `Data ultima parcela`.
Cadastro/atendimento de cliente exibe input com placeholder dd/mm/aaaa.
