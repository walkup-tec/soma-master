# LOG — Kanban não mostrava status do Comercial 01

## Contexto
Listagem de Clientes do Comercial 01 tem vários status; o Kanban Status aparecia quase só “Novo”.

## Causa raiz
1. `listKanbanClientsForUser` limitava a **800** registros, ordenados por data (contato/cadastro) desc.
2. Comercial 01 tem **1028** clientes (~1000 `novo` recentes da importação).
3. Com o corte, o board carregava só: Novo (797), Aguardando documentação (2), Perdido (1).
4. Fora do top 800: Aguardando retorno (7), Em atendimento (4), Concluído (1) e 13 de documentação.

## Correção
- `KANBAN_BOARD_LIMIT` 800 → **5000**
- Join de agenda via `lateral` (1 schedule por cliente, evita inflar linhas)
- Período padrão do Status: **Todos** (+ opção na UI)

## Validação
Como Comercial 01 no Kanban Status → Todos: deve listar 6 colunas de status alinhadas à listagem.

## Keywords
kanban limit 800, Comercial 01, status faltando, KANBAN_BOARD_LIMIT
