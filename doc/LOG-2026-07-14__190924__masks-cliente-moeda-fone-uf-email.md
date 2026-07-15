# LOG — Máscaras e validação nos campos de cliente

## Contexto
Pedido: no cadastro de clientes, aplicar máscara de moeda (R$ milhar) em renda/valores, telefone com DDD, select de UF, e-mail com formato válido.

## Solução
- Helpers: `src/lib/masks/br-currency.ts`, `br-phone.ts`, `email.ts` + `src/lib/geo/brazil-ufs.ts`
- `ClientFieldInput` centraliza máscaras/selects (renda_mensal, valor_desejado, valor_liberado, margem_disponivel, telefone, whatsapp, uf, email)
- Cadastro manual: bloqueia avanço se e-mail inválido ou telefone incompleto (&lt; 10 dígitos)
- Server: `createManualSchema` rejeita e-mail inválido

## Arquivos
- `src/components/clients/client-field-input.tsx`
- `src/components/clients/client-create-manual-dialog.tsx`
- `src/lib/clients/clients.server.ts`
- Novos: masks + brazil-ufs

## Como validar
1. Clientes → Novo cliente → preencher campos com máscaras
2. UF: select 27 UFs
3. E-mail inválido: botão não avança / toast

## Keywords
mascara, R$, telefone DDD, UF, email, ClientFieldInput, valor_desejado, renda_mensal
