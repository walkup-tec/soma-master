# LOG — Nodes Expediente + Saudação (Bots)

## Contexto
Dois nodes no desenvolvedor de fluxo: Chatbot Expediente (3 saídas por turno Brasília) e IA Saudação (prompt + institucional).

## Solução
- `bot-expediente.ts`: resolve turno America/Sao_Paulo (00:01–12:00 / 12:01–18:00 / 18:01–00:00).
- `bot-saudacao.service.ts`: OpenAI com turno + institucional; fallback template se sem chave/dry-run.
- Registry, runtime, UI (ícones + painel de config).

## Arquivos
- src/lib/bots/bot-expediente.ts (novo)
- src/lib/bots/bot-saudacao.service.ts (novo)
- src/lib/bots/bot.types.ts, bot-node.registry.ts, bot-runtime.engine.ts, bots.server.ts
- src/components/bots/bot-flow-node.tsx, bot-node-config-panel.tsx

## Validar
1. Arrastar Expediente e Saudação no builder.
2. Ligar as 3 saídas do Expediente a ramos distintos.
3. Configurar institucional na Saudação e testar execução com OpenAI.

## Keywords
bots, expediente, saudacao, brasilia, openai, fluxo
