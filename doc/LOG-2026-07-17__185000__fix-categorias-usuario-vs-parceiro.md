# LOG — Separar categorias de usuário e de parceiro

**Data:** 2026-07-17 ~18:50  
**Pedido:** Em Configurações → Categorias de usuário apareciam categorias de parceiro (Corban, Substabelecido, Suporte…). Não deve haver correlação; restaurar categorias de usuário como antes.

## Causa

`ensure-partner-schema.ts` seedava labels de parceiro em `crm.user_categories` com IDs `cat-*` (ex.: `cat-corban`), colidindo com Atendente/Gerente e poluindo a lista admin.

## Solução

1. Parceiros passam a usar IDs técnicos `partner-cat-{categoria}` (FK em `users.category_id`), sem aparecer na UI.
2. Boot remapeia usuários com `partner_profiles` (exceto master) para `partner-cat-*`.
3. Restaura Master / Atendente / Gerente se `home_menu_id = 'parceiros'`.
4. Remove legado `cat-substabelecido|suporte|corban` quando sem referências.
5. Load/save de settings filtra e preserva `partner-cat-*`.

## Arquivos

- `src/lib/partners/partner.constants.ts`
- `src/lib/partners/partner.repository.ts`
- `src/lib/db/ensure-partner-schema.ts`
- `src/lib/config/settings.repository.ts`
- `src/lib/config/settings-defaults.ts`
- `src/lib/db/postgres.ts`

## Validar

Após redeploy: Configurações → Categorias de usuário deve listar **Master, Atendente, Gerente** (e customizações do admin), sem Corban/Substabelecido/Suporte. Cadastro de parceiro continua com as 5 categorias no formulário de parceiros.

## Keywords

categorias usuário, partner-cat, user_categories, parceiros, configurações
