# LOG — Construtor de Funil v1 (modal tela cheia)

**Data:** 2026-07-19 14:25:22  
**Repo:** Soma

## Pedido

Na aba Funil: botão **Novo Funil** abre modal **100% da tela** com construtor arrasta-e-conecta (referência Typebot / BotConversa). Primeira versão para iterar.

## Solução

- Dependência `@xyflow/react` (React Flow)
- Modal fullscreen (`fixed inset-0`, portal no `body`)
- Canvas: painel de etapas | fluxo | propriedades
- Etapas: Início (fixo), Mensagem, Espera, Condição (sim/não), Fim
- Arrastar nós, conectar handles, editar título/descrição, salvar rascunho em `localStorage`

## Arquivos

- `src/components/marketing/funnel/funnel-builder-modal.tsx`
- `src/components/marketing/funnel/funnel-builder-canvas.tsx`
- `src/components/marketing/funnel/funnel-step-node.tsx`
- `src/lib/marketing/funnel.types.ts`
- `src/components/marketing/marketing-panels.tsx`
- `package.json` / `package-lock.json`

## Próximos ajustes (combinar)

Persistência no servidor, disparo WhatsApp real, templates de mensagem, validação de fluxo, zoom UX, etc.
