# Status sem nota tambem gera historico

Ao alterar o status no modal Registrar atendimento, cria registro em `client_attendances` com nota:
`Status alterado para: {label} (antes: {label})`

Retorno de `updateClientStatusFn`: `{ client, attendance }`.
