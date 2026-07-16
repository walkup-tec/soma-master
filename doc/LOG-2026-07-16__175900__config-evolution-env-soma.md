# LOG — Configurar Evolution no Soma

## Contexto

UI ChatBot mostrava “Evolution não configurada” (API vazia).

## Ações

1. Copiou `EVO_API_URL` / `EVO_API_KEY` de `D:\Waba\.env` → `EVOLUTION_*` em `D:\Soma\.env.local`
2. `EVOLUTION_INSTANCE=soma-crm`; `OPENAI_API_KEY` do Waba; `CHAT_WEBHOOK_SECRET` gerado
3. Estendeu `load-env-file.ts` para injetar `EVOLUTION_*`, `OPENAI_*`, `CHAT_*` (antes só DB/mail)
4. Reiniciou Vite `:3090`
5. Validou: `configured: true`, host walkup-evo…, fetchInstances HTTP 200

## Segurança

Segredos não commitados; `.env.local` permanece local.

## Keywords

evolution, EVO_API, EVOLUTION_API, soma-crm, load-env-file, chatbot
