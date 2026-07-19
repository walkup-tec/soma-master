# LOG — Marketing: submenu + tela com abas

## Contexto
Criar submenu **Marketing** abaixo de Comercial (Produção própria), com tela no padrão das Configurações (tabs horizontais).

## Abas
- Números WhatsApp
- Funil
- API Alternativa

## Solução
1. `MenuGroupId` `Funil e WhatsApp` → `Marketing`.
2. Item de menu `marketing` → `/app/marketing` (Chat WhatsApp permanece no mesmo grupo).
3. Rota com `?tab=` e painéis iniciais (estrutura pronta para conteúdo).
4. `routeTree.gen.ts` regenerado.

## Arquivos
- `src/lib/config/menu-items.ts`
- `src/lib/config/menu-nav.tsx`
- `src/routes/app/marketing.tsx`
- `src/components/marketing/marketing-panels.tsx`
- `src/routeTree.gen.ts`

## Keywords
marketing, funil, api-alternativa, numeros-whatsapp, tabs, menu
