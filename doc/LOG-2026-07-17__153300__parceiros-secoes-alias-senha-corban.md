# Parceiros — seções, aliases de acesso e Corban

## Contexto

O cadastro de parceiros precisava permitir selecionar as seções **Parceiros** e/ou
**Produção própria**, exibindo somente depois os submenus de cada seção. Também foi
solicitada senha numérica de 4 dígitos, completada por alias da categoria, e a nova
categoria Corban.

## Solicitações abertas

- Concluído neste bloco: seleção independente das duas seções e respectivos submenus.
- Concluído neste bloco: senha de 4 dígitos com código completo exibido para cópia.
- Concluído neste bloco: Corban com alias `CN`.
- Pendente de pedido anterior: integração de consulta de CNPJ pela BrazilAPI.
- Commit, push e deploy não foram solicitados neste bloco.

## Solução implementada

1. A tela agora seleciona primeiro as seções permitidas; é possível manter as duas
   ativas simultaneamente.
2. Ao desmarcar uma seção, seus submenus são removidos das permissões do formulário.
3. O backend continua validando que ao menos um submenu foi escolhido e impede conceder
   acessos que o responsável não possui.
4. A senha aceita exatamente 4 números. O backend concatena o alias antes de gerar o
   hash: `SB`, `GE`, `SE`, `CN` ou `AE`.
5. O código completo é devolvido somente após criação/troca de senha e exibido em modal
   com ação de copiar. A senha não é salva nem registrada em texto aberto.
6. Ao trocar a categoria durante uma edição, uma nova senha é obrigatória para manter o
   alias coerente.
7. O schema idempotente passou a aceitar `corban` e cadastra `cat-corban`.

## Arquivos alterados

- `src/components/partners/partner-form-dialog.tsx`
- `src/lib/db/ensure-partner-schema.ts`
- `src/lib/partners/partner.constants.ts`
- `src/lib/partners/partner.service.ts`
- `src/lib/partners/partner.types.ts`
- `doc/memoria.md`

## Comandos e validações

- Prettier nos arquivos alterados: OK.
- ESLint nos arquivos alterados: OK.
- `npm run build`: OK, incluindo client e SSR.
- Reinício do `npm run dev`: servidor saudável.
- `curl http://127.0.0.1:3090/login`: HTTP 200.
- Primeira tentativa de encadear Prettier + ESLint com `&&`: falhou porque a versão
  local do PowerShell não aceita esse separador; repetido com verificação de
  `$LASTEXITCODE`, com sucesso.

## Segurança

- O código completo existe em texto aberto apenas durante a resposta da criação/troca
  de senha para permitir a cópia; no banco permanece somente hash e salt.
- Nenhum segredo ou credencial foi incluído nos arquivos ou logs.

## Palavras-chave

`parceiros`, `menu sections`, `producao-propria`, `corban`, `CN`, `senha 4 digitos`,
`partnerCategoryAlias`, `PartnerSaveResult`
