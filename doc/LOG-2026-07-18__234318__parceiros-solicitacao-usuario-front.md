# LOG — Parceiros: menu Solicitação Usuário (front)

## Contexto
Novo item em PARCEIROS → Gestão: **Solicitação Usuário**, com listagem front-only.

## Colunas
- Parceiro
- Produto
- Banco

## Solução
1. Menu `parceiros-solicitacao-usuario` → `/app/parceiros/solicitacao-usuario`
2. Tela com tabela vazia (dados depois)
3. `routeTree.gen.ts` regenerado

## Arquivos
- `src/lib/config/menu-items.ts`
- `src/lib/config/menu-nav.tsx`
- `src/routes/app/parceiros.solicitacao-usuario.tsx`
- `src/components/partners/partner-user-requests-screen.tsx`
- `src/lib/partners/partner-user-request.types.ts`

## Keywords
parceiros, solicitacao-usuario, listagem, front
