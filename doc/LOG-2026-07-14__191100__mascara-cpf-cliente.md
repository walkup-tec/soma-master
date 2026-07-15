# LOG — Máscara CPF no cadastro

## Contexto
Pedido: máscara no formato CPF.

## Solução
- `src/lib/masks/br-cpf.ts` — `maskCpf` / `cpfDigits` → `000.000.000-00`
- `ClientFieldInput` aplica no campo `cpf`
- Cadastro manual: bloqueia avanço se CPF preenchido com menos de 11 dígitos

## Keywords
CPF, maskCpf, ClientFieldInput
