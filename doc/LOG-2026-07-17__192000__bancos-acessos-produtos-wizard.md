# LOG — Bancos (acessos/roteiro) + wizard Produtos

**Data:** 2026-07-17 ~19:20  
**Pedido:** Evoluir Bancos (Storm/Banco/roteiro PDF) e Produtos em etapas (nome+cor, bancos multi, campos por grupo, parceiros).

## Bancos

- Opções: Acesso Storm, Acesso Banco, Roteiro Operacional (PDF + nome de exibição).
- Credenciais gravadas para consulta; botões copiar após salvar.
- Upload PDF → `data/bank-guides/` + meta no banco.

## Produtos (wizard)

1. Nome + cor (inline)  
2. Multi-seleção de bancos  
3. Config. dados pessoais (cadastro)  
4. Dados pessoais (endereço)  
5. Dados profissionais  
6. Dados financeiros  
7. Disponibilizar para parceiros (Sim/Não)

## Persistência

- Colunas em `crm.banks` / `crm.products.available_for_partners`
- `crm.product_banks`
- Types em `settings-types.ts`

## Keywords

bancos storm, roteiro pdf, produtos wizard, availableForPartners, product_banks
