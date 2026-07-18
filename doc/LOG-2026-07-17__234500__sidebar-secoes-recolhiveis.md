# LOG — Sidebar seções recolhíveis

**Data:** 2026-07-17 23:45  
**Slug:** sidebar-secoes-recolhiveis

## Contexto
Confirmar e documentar seções **PARCEIROS** e **PRODUÇÃO PRÓPRIA** recolhíveis no menu lateral (`src/components/app-sidebar.tsx`).

## Confirmação
- Seções `parceiros` e `producao-propria` com estado `openBySection`.
- Botão no cabeçalho com `toggleSection` + `ChevronDown` (`aria-expanded`).
- Persistência em `sessionStorage` (`soma.sidebar.sectionsOpen`).
- Seção da rota ativa abre automaticamente; modo ícone mantém itens visíveis.

## Arquivos
- `src/components/app-sidebar.tsx` (implementação)
- `doc/memoria.md` (nota no topo)
- Este LOG

## Validação
- Abrir menu expandido → clicar cabeçalho PARCEIROS / PRODUÇÃO PRÓPRIA → itens recolhem/expandem.
- Navegar para rota de uma seção fechada → seção abre sozinha.
