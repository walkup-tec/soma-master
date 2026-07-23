# LOG — Construtor de Bots (fluxo híbrido)

## Contexto
Pedido: menu **Bots** abaixo de **Funil e WhatsApp**, com construtor visual em tela cheia (estilo N8N/Langflow/Typebot), nodes Chatbot / IA / Sistema, Mapear dados (OCR+LLM), execução de teste por número WhatsApp.

## Solução
- Menu `bots` em `menu-items.ts` (grupo Funil e WhatsApp) + ícone em `menu-nav.tsx` + título no topbar.
- Rota `/app/bots` com listagem e modal fullscreen.
- Registry modular `BOT_NODE_REGISTRY` — novos nodes sem alterar o núcleo.
- Motor híbrido `executeBotNode` / `advanceBotRun` (flow | llm | system).
- Node **Mapear dados** com extração OCR/LLM (`bot-map-data.service.ts`) e campos parametrizados.
- **Execução de fluxo**: informa WhatsApp de teste; envia via Evolution quando configurada.

## Arquivos principais
- `src/lib/bots/*`
- `src/components/bots/*`
- `src/routes/app/bots.tsx`
- `src/lib/config/menu-items.ts`, `menu-nav.tsx`
- `src/routeTree.gen.ts`

## Como validar
1. Abrir Soma → menu **Bots** (abaixo de Funil e WhatsApp).
2. Novo bot → arrastar nodes Chatbot/IA/Sistema → conectar.
3. Configurar node, ver I/O, Vars, Logs e **Teste individual**.
4. Em Mapear dados: selecionar campos + enviar PDF/imagem (requer `OPENAI_API_KEY`).
5. **Execução de fluxo** → informar número de teste.

## Segurança
- Server fns exigem sessão + menu `bots` (fallback `marketing`).
- Sem log de API keys; mídia enviada só ao OpenAI no Mapear dados.

## Palavras-chave
bots, construtor, reactflow, mapear-dados, ocr, openai, execução-fluxo, omnichannel
