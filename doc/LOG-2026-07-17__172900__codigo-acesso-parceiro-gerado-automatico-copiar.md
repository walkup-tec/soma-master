# LOG — Código de acesso do parceiro gerado automaticamente + ícone copiar

**Data:** 2026-07-17 17:29
**Contexto:** Pedido do usuário: "Sistema irá gerar todo o código, a cada nova tela aberta e definida a categoria, o sistema gera o código. Precisamos de um icon para copiar o código."

## O que mudou

Antes o usuário digitava os 4 dígitos da senha. Agora o sistema gera o código completo sozinho:

1. **Ao abrir o formulário de novo parceiro** → 4 dígitos aleatórios já preenchidos (via `crypto.getRandomValues`).
2. **Ao trocar a categoria** → novo código gerado (alias muda junto: SB/GE/SE/CN/AE).
   - Em edição, se voltar à categoria original, o campo é limpo (mantém a senha atual).
3. **Campo somente leitura** com prefixo do alias + dígitos visíveis (fonte mono).
4. **Botão `RefreshCw`** — gerar novo código manualmente (útil na edição para trocar a senha).
5. **Botão `Copy`** — copia o código completo (ex.: `GE1234`) para a área de transferência, com toast de confirmação e fallback de erro.
6. Texto auxiliar mostra o código final gerado; em edição sem código, informa que a senha atual será mantida.

O modal pós-salvamento com o código e botão copiar (implementado antes) continua funcionando.

## Arquivos alterados

- `src/components/partners/partner-form-dialog.tsx`
  - `generateAccessDigits()` (crypto random, 4 dígitos, padStart)
  - `handleCategoryChange` regenera/limpa o código
  - `regenerateAccessCode()` e `copyAccessCode()`
  - UI do campo de senha: readOnly + alias + botões RefreshCw/Copy

## Validação

- `prettier` + `eslint` no arquivo: OK
- `npm run build` (client + SSR): OK

## Segurança

- Geração com `crypto.getRandomValues` (não `Math.random`).
- Hash da senha continua no backend (sem mudança no service/repository).

## Palavras-chave

parceiros, codigo de acesso, senha 4 digitos, alias SB GE SE CN AE, copiar codigo, crypto.getRandomValues, partner-form-dialog
