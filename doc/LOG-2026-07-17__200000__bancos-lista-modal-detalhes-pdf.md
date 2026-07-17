# LOG — Lista de bancos + modal detalhes + PDF download

**Data:** 2026-07-17 ~20:00  
**Pedido:** Após salvar, listar bancos (Nome, Produto, Acessos, Detalhes); checks Storm/Banco/Link/Roteiro; modal com dados + download PDF; formulário novo limpo em cards inline.

## Solução

- Lista em tabela a partir dos bancos salvos
- Coluna Produto = produtos com `bankIds` contendo o banco
- Acessos: 4 badges (Storm, Banco, Link, Roteiro)
- Detalhes → modal (copiar campos + baixar PDF)
- Novo banco → draft vazio; Storm/Banco/Roteiro em 3 cards lado a lado
- API `GET /api/banks/guides/$storageId`

## Keywords

bancos lista, modal detalhes, download pdf roteiro, cards inline
