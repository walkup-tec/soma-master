# LOG — Restaurar Chatbot + IA pós-reimplant

## Contexto

Após reimplant SV→Soma (base funcionando), o usuário pediu para trazer de volta os recursos de **Chat WhatsApp + IA** implantados antes, **sem quebrar** o que já funciona (login, Clientes, branding, porta 3090).

## Problema

O código de chat/IA **não estava no git** nem no backup seletivo de logos/env. Foi recuperado do transcript Cursor:

`0e9e585d-d2a5-4f19-8c10-2990b8b569f6`

Staging: `D:\Soma-chat-restore\`

## Solução

1. Extrair Writes/StrReplaces do transcript (`extract_chat.py`).
2. Copiar módulo para `D:\Soma` (lib/chat, components/chat, rotas chat + APIs chatbot).
3. Wiring cirúrgico:
   - menu `chat` em `menu-items.ts` / `menu-nav.tsx`
   - webhook em `server.ts` (`/api/chat/whatsapp-webhook`, `/api/webhooks/evolution`)
   - `ensureChatSchema` em `ensure-client-indexes.ts`
4. **Configurações:** manter **Radix Tabs** + `useSystemSettings` (o que funciona hoje); só acrescentar aba **ChatBot** com loader URL (`?tab=chatbot&panel=evo|ia`) para redirects dos forms EVO/IA.
5. `EVOLUTION_INSTANCE` no `.env.local` ajustado para `soma-crm` (prefixo obrigatório `soma-`).

## Arquivos criados/alterados

**Novos:** `src/lib/chat/*`, `src/components/chat/*`, `src/components/settings/chatbot-settings.tsx`, `src/routes/app/chat.tsx`, `src/routes/app/chat.ia.tsx`, `src/routes/api/settings/chatbot/*`, `doc/CHAT-WHATSAPP-IA.md` (se presente)

**Alterados:** `menu-items.ts`, `menu-nav.tsx`, `server.ts`, `ensure-client-indexes.ts`, `configuracoes.tsx`, `.env.local` (instance), `routeTree.gen.ts` (auto)

**Não tocados de propósito:** Clientes, auth login flow, logos, `styles.css`, `node_modules`, sem `client.tsx` custom.

## Validação

- `http://127.0.0.1:3090/login` → 200, “Soma Promotora”, sem “Sinal Verde”
- `/app/chat` → 307 (auth) — rota registrada
- `/api/chat/whatsapp-webhook` GET → 200
- Schema Postgres: tabelas `crm.chat_*` já existiam / `IF NOT EXISTS` OK
- Vite regenerou `routeTree.gen.ts` com `/app/chat`, `/app/chat/ia`, APIs chatbot

## Segurança

- Sem log de API keys
- Instância EVO isolada (`soma-*`); webhook ignora outras instâncias
- `CHAT_WEBHOOK_SECRET` opcional no header

## Keywords

chat, chatbot, whatsapp, evolution, openai, inbox, ia-education, reimplant-restore, configuracoes-chatbot
