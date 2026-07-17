# LOG — Máscaras, validação de e-mail e campos obrigatórios em Parceiros

**Data:** 2026-07-17 15:15

## Contexto

No formulário de parceiros, aplicar máscaras nos campos necessários, validar formato de e-mail e tornar obrigatórios todos os campos atualmente configurados (exceto complemento e senha na edição).

## Solução

### Máscaras (digitação e edição)

- CPF: `000.000.000-00`
- CNPJ: `00.000.000/0000-00`
- Telefone / WhatsApp: `(00) 00000-0000` / `(00) 0000-0000`
- CEP: `00000-000`
- Chave PIX: mascara conforme o tipo (CPF, telefone, e-mail ou texto aleatório)
- UF: select com estados brasileiros (não texto livre)

Novos helpers: `src/lib/masks/br-cnpj.ts`, `br-cep.ts`, `br-tax-id.ts`. Reuso de `br-cpf`, `br-phone` e `email`.

### Validação

- E-mail obrigatório com formato (`isFilledValidEmail`); feedback imediato no campo.
- Chave PIX por tipo (CPF/telefone/e-mail/aleatória) no client e no service.
- Backend reforça: CEP completo, telefone/WhatsApp com DDD, UF válida, ao menos 1 banco e 1 menu.

### Obrigatoriedade

Obrigatorios (marcados com `*`): categoria, tipo de pessoa, nome/razão, CPF ou CNPJ, RG (PF), e-mail, senha (criação), telefone, WhatsApp, tipo/chave PIX, CEP, endereço, número, bairro, cidade, UF, bancos e menus.

Opcionais: complemento; senha na edição (mantém a atual se vazia).

## Arquivos

- `src/components/partners/partner-form-dialog.tsx`
- `src/components/partners/partners-screen.tsx`
- `src/lib/partners/partner.service.ts`
- `src/lib/masks/br-cnpj.ts`, `br-cep.ts`, `br-tax-id.ts`, `email.ts`

## Validação

- ESLint OK nos arquivos alterados
- TypeScript sem erros novos no domínio
- `npm run build` client+SSR OK

## Palavras-chave

máscara CPF CNPJ CEP telefone, validação e-mail, campos obrigatórios parceiros, chave PIX mascara
