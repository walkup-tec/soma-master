# Integração BrasilAPI CNPJ no cadastro de parceiros

## Contexto

No cadastro de parceiro Pessoa Jurídica, o CNPJ deve ser o primeiro dado empresarial
informado. A partir dele, o sistema consulta a BrasilAPI e preenche os demais campos
disponíveis, seguindo a experiência já usada na consulta de CEP.

## Solicitações abertas

- Concluído: consulta de CNPJ pela BrasilAPI no formulário PJ.
- Concluído: CNPJ posicionado antes da razão social.
- Pendente de validação funcional em produção após futuro deploy.
- Commit, push e deploy não foram solicitados neste bloco.

## Documentação oficial consultada

- https://brasilapi.com.br/docs#tag/CNPJ/paths/~1api~1cnpj~1v1~1{cnpj}/get
- https://brasilapi.com.br/api/cnpj/v1/33000167000101

A documentação confirma CNPJ com 14 dígitos, resposta `200`, `400` para valor inválido
e `404` para CNPJ não encontrado.

## Solução implementada

1. Criado adapter dedicado para `GET /api/cnpj/v1/{cnpj}`.
2. O adapter usa timeout de 6 segundos por tentativa e uma repetição com backoff/jitter
   somente para timeout, rede, `429` ou `5xx`.
3. Respostas externas são normalizadas para um contrato interno pequeno, sem repassar o
   payload completo da Receita Federal ao frontend.
4. A server function exige sessão com acesso à área Parceiros.
5. No formulário PJ, o CNPJ aparece antes da razão social, com botão **Buscar**.
6. A consulta preenche, quando disponíveis: razão social, e-mail, telefone, WhatsApp,
   CEP, endereço, bairro, cidade, UF, complemento e número.
7. Campos ausentes ou inválidos retornados pela API não apagam informações já digitadas.
8. Situação cadastral diferente de `ATIVA` gera aviso visual.

## Arquivos criados/alterados

- `src/lib/partners/brasil-api-cnpj.adapter.ts`
- `src/lib/partners/partners.server.ts`
- `src/components/partners/partner-form-dialog.tsx`
- `doc/memoria.md`

## Comandos e validações

- Consulta real ao endpoint oficial com CNPJ público: HTTP 200 e payload compatível.
- Prettier: OK.
- ESLint nos arquivos alterados: OK.
- `npm run build`: OK para client e SSR.
- Aplicação local: `/login` respondeu HTTP 200 após HMR.

## Segurança e resiliência

- Integração gratuita e sem chave; nenhum segredo foi adicionado.
- O CNPJ não é registrado em logs pelo adapter.
- A resposta completa, incluindo QSA e outros dados não utilizados, não é devolvida ao
  navegador.
- Erros externos são convertidos em mensagens seguras e operacionais.

## Palavras-chave

`BrasilAPI`, `CNPJ`, `Pessoa Jurídica`, `lookupPartnerCnpjFn`,
`brasil-api-cnpj.adapter`, `autopreenchimento empresa`
