# LOG — Roteiro no produto + campos dinâmicos em Dados

**Data:** 2026-07-26

## Contexto
Roteiro Operacional estava na criação de Banco; deve ser penúltima etapa da criação de Produto.
Master deve poder adicionar campos dinâmicos em Dados (nascem disponíveis; podem virar obrigatórios).

## Solução
1. `ProductConfig` ganhou `operationalGuide*` + `customFields`.
2. Wizard de produto: etapa `roteiro` antes de `partners` (produção) / última (parceiros).
3. UI Bancos: removido upload/exibição de roteiro (salvar zera guia legado no banco).
4. Master: `Adicionar campo` em Config. dados pessoais / profissionais / financeiros; ids `custom-*`.
5. Persistência Postgres: colunas em `crm.products` (custom_fields jsonb + operational_guide_*).

## Arquivos
- `src/lib/config/settings-types.ts`
- `src/lib/config/settings-defaults.ts`
- `src/lib/config/settings.repository.ts`
- `src/lib/config/settings.server.ts`
- `src/lib/config/client-fields.ts`
- `src/lib/clients/product-fields.ts`
- `src/components/settings/products-settings.tsx`
- `src/components/settings/banks-settings.tsx`

## Validar
1. Configurações → Produtos → Novo produto → etapas até Roteiro Operacional (antes de Parceiros).
2. Upload PDF + nome; salvar; baixar.
3. Em Dados financeiros: master adiciona campo → aparece Disponível; marcar Obrigatório.
4. Bancos: formulário sem Roteiro.

## Keywords
roteiro-operacional, produto, bancos, custom-fields, master, disponivel, obrigatorio
