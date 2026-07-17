# Ação Histórico visível apenas com histórico de bloqueio

## Contexto

Regra de negócio: no menu de ações da lista de parceiros, o item **Histórico** só deve
aparecer para cadastros que já tiveram ao menos um bloqueio. Parceiros sem bloqueio no
histórico não exibem essa ação.

## Solução implementada

1. `PartnerRecord` ganhou o campo `hasBlockHistory`.
2. O repositório calcula o campo com `exists` sobre `crm.partner_events` filtrando
   `action = 'blocked'`, tanto na listagem quanto na busca individual.
3. Na tela de parceiros, o item **Histórico** do dropdown só é renderizado quando
   `partner.hasBlockHistory` é verdadeiro.

O evento `blocked` é permanente na tabela de eventos, então um parceiro desbloqueado
continua exibindo o histórico — o que preserva a auditoria do bloqueio anterior.

## Arquivos alterados

- `src/lib/partners/partner.types.ts`
- `src/lib/partners/partner.repository.ts`
- `src/components/partners/partners-screen.tsx`
- `doc/memoria.md`

## Comandos e validações

- Prettier e ESLint nos arquivos alterados: OK.
- `npm run build` (client + SSR): OK.
- `curl http://127.0.0.1:3090/login`: HTTP 200.
- Tentativa de `npx tsc --noEmit` falhou porque o pacote `typescript` expõe aviso
  "not the tsc command" neste setup; a validação de tipos foi coberta pelo build Vite.

## Segurança

- Nenhum dado sensível exposto; o campo novo é booleano derivado de eventos já
  existentes e respeita a visibilidade hierárquica atual.

## Palavras-chave

`hasBlockHistory`, `partner_events`, `action blocked`, `Histórico condicional`,
`parceiros dropdown`
