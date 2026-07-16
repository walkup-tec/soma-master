# Memória Soma

## 2026-07-16 — Deploy Easypanel Soma

- Repo: `https://github.com/walkup-tec/soma-master.git` (`main`)
- Domínio painel: `https://app.somaconecta.com.br` → porta **3000**
- Dockerfile + Nitro `node-server` (igual SV)
- Env: `D:\Soma\.env.easypanel` (não commitado)
- Webhook: `https://app.somaconecta.com.br/api/chat/whatsapp-webhook`

## 2026-07-16 — Fix /app/chat “This page didn't load”

- Causa: cache `ensureChatSchema` pulava ALTER `webhook_public_base_url` + inbox importava `auth.server`
- Fix: migrations leves sempre; `currentUserId` no bootstrap
- Reiniciar Vite se a página ainda falhar

## 2026-07-16 — Chatbot Inbox + Integração EVO

- Params do chatbot só em Config → **Integração EVO** (QR + webhook + IA + teste inbound)
- Inbox Chatwoot-like: Meus / Não atribuídos / Todos + cartão contato
- Refs: Chatwoot dashboard basics; BotConversa live chat
- LOG: `doc/LOG-2026-07-16__181500__chatbot-inbox-integracao-evo.md`

## 2026-07-16 — ChatBot UI cursor-pointer

- Abas EVO/IA + botões nativos (QR, educação IA) com `cursor-pointer`

## 2026-07-16 — EVO configurado no Soma (.env.local)

- Fonte: `D:\Waba\.env` (`EVO_API_*` → `EVOLUTION_API_*`), instância `soma-crm`
- `OPENAI_API_KEY` também copiada; `CHAT_WEBHOOK_SECRET` gerado
- `load-env-file.ts` passou a injetar `EVOLUTION_*` / `OPENAI_*` / `CHAT_*`
- Reiniciar Vite após mudar `.env.local`

## 2026-07-16 — Fix import-protection Configurações

- Causa: `getSession` / repos no route client de `configuracoes.tsx`
- Fix: `getChatbotSettingsLoaderFn` (RPC) + chat usa `getSystemSettingsFn`
- LOG: `doc/LOG-2026-07-16__175400__fix-configuracoes-import-protection.md`

## 2026-07-16 — Restore Chatbot + IA (pós-reimplant)

- Recurso recuperado do transcript (não estava no git/backup logos)
- Rotas: `/app/chat`, `/app/chat/ia`, Config → aba ChatBot, webhook `/api/chat/whatsapp-webhook`
- Configurações: Radix preservado + aba ChatBot (URL `?tab=chatbot`)
- Env: `OPENAI_*`, `EVOLUTION_*` (`soma-crm`), `CHAT_WEBHOOK_SECRET`
- LOG: `doc/LOG-2026-07-16__160831__restore-chatbot-ia-pos-reimplant.md`
- Keywords: chat, evolution, openai, chatbot, restore

## 2026-07-16 — Reimplant zero SV→Soma

- Código base = Sinal Verde; preservados env, logos/favicon, cores style, logo.tsx, tema
- Dev: http://127.0.0.1:3090 — remote git `soma-master`
- LOG: `doc/LOG-2026-07-16__151700__reimplant-zero-sv-para-soma.md`
- `node_modules` físico próprio (sem junction) — entry TanStack padrão
- Keywords: reimplant, logos, env, cores, node_modules próprio
- Acesse: http://127.0.0.1:3090/login

## Preservar sempre

| Item | Onde |
|------|------|
| Env | `.env.local` |
| Logos | `public/brand/logo-claro.png`, `logo-escuro.png` (+ svg) |
| Favicons | `public/favicon*.png`, `favicon-soma.png`, `favicon.ico` |
| Cores | `src/styles.css` — `#be1c6a` `#ecf759` `#2775e5` `#f5f5f5` |
| Logo component | `src/components/logo.tsx` + `src/lib/theme/soma-theme.ts` |
| Backup | `D:\Soma-reimplant-preserve-20260716-142637` |
