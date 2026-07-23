# LOG — Bots: duplicar, multi-selecao e Botoes dinamicos

## Contexto
Duplicar node, lasso multi-select + duplicar lote, e node Botoes com inputs Enter e saidas por opcao.

## Solucao
- Canvas: selectionOnDrag, SelectionMode.Partial, pan botao meio/direito, Ctrl+D, barra Duplicar/Remover.
- Botoes: inputs dinamicos (Enter adiciona), handles por opcao + Fallback.
- Runtime: waitForReply + match da resposta para nextHandle da opcao.

## Keywords
bots, duplicate, multi-select, buttons, saidas dinamicas
