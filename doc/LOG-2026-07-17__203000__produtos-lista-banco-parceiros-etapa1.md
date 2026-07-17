# LOG — Lista produto×banco na Etapa 1 do wizard

## Contexto

Após cadastrar Produto vinculado a mais de um banco, listar abaixo do input “Nome do produto”. Cada banco = uma linha. Coluna Parceiros com check quando `availableForPartners`. Ao concluir a última etapa, voltar à Etapa 1 com o produto na lista.

## Solução

- Helper `buildProductBankListRows`: expande `products × bankIds` (sem banco → linha com “—”).
- Etapa 1 (identity): tabela Nome do produto | Banco | Parceiros abaixo do formulário nome/cor.
- Clique na linha seleciona o produto.
- Botão **Concluir**: persiste, `setStepIndex(0)`, toast “Produto salvo.”

## Arquivos

- `src/components/settings/products-settings.tsx`

## Validar

1. Criar produto com 2 bancos + parceiros Sim → Concluir.
2. Volta Etapa 1; duas linhas com mesmo nome e bancos diferentes; check em Parceiros.
3. Produto sem banco aparece com Banco “—”.

## Keywords

produtos lista, product_banks, availableForPartners, wizard etapa 1
