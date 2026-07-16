## 2026-07-16 — SIGTERM apos Listening

- Listening OK; SIGTERM = Easypanel/Docker (nao Traefik morto).
- Alinhar proxy do painel a **3000** (como Sinal Verde) + `/api/health`.
- Keywords: `SIGTERM`, `proxy port`, `3000`, `health`
# MemÃ³ria Soma

## 2026-07-16 â€” Entrypoint CRLF (sem Listening)

- ApÃ³s echo `Nitro 0.0.0.0:80` o Node nÃ£o chegava a Listening (memÃ³ria ~13 MB, 502).
- Causa: CRLF no `docker-entrypoint.sh` â†’ `exec` quebra no Linux.
- Fix: `.gitattributes` eol=lf + `sed` no Dockerfile + `docker-start.mjs`.
- Keywords: `CRLF`, `entrypoint`, `Listening`, `index.mjs`

## 2026-07-16 â€” PORT Easypanel = porta do Traefik (nÃ£o forÃ§ar 3000)

- Sintoma: Nitro sobe e logo `Server closed successfully` (SIGTERM) + 502/404.
- Causa real: painel injeta `PORT=80` (= porta do domÃ­nio/Traefik). ForÃ§ar app em **3000** deixava Traefik sem backend â†’ healthcheck/orquestrador mata o container.
- Fix: escutar `PORT` do ambiente; imagem como root (bind :80); `docker-signal-log.mjs` loga SIGTERM.
- Painel: DomÃ­nio HTTP = **mesma** porta do log (`80` se raw PORT=80). NÃ£o misturar 80 no env e 3000 no domÃ­nio.
- Keywords: `PORT=80`, `SIGTERM`, `Server closed successfully`, `nitro`, `502`

## 2026-07-16 â€” (obsoleto) forÃ§ar Nitro 3000

- Tentativa `2bbfc76` forÃ§ou 3000; piorou o mismatch. SubstituÃ­da pelo fix acima.

## 2026-07-16 â€” Traefik / mesmo VPS que WABA

- **IP compartilhado:** `72.60.51.127` (Soma `*.achpyp.easypanel.host`, `app.somaconecta.com.br`, Evolution walkup, WABA).
- Traefik do WABA **jÃ¡ estÃ¡ de pÃ©** (`wabadisparos.com.br` 200). Problema atual Soma: host Easypanel **502** + domÃ­nio custom **404** â†’ app/domÃ­nio, nÃ£o â€œTraefik mortoâ€.
- LiÃ§Ãµes WABA aplicam: entryPoints sÃ³ `http`/`https`; sem `force` Traefik; sem thrash de heals; backend preferir host gateway apÃ³s inspeÃ§Ã£o.
- **NÃ£o** instalar heals WABA (`30180`/`30210`) para o Soma. Rule: `.cursor/rules/soma-traefik-mesmo-vps-waba.mdc`.
- Ordem: Redeploy atÃ© easypanel.host **/login = 200** â†’ domÃ­nio :3000 â†’ cert ACME.
- Keywords: `traefik`, `502`, `404 not-found`, `entrypoints`, `achpyp`, `72.60.51.127`, `waba-shared-vps`

## 2026-07-16 â€” Ambientes + logo menu

- Local fixo: `http://127.0.0.1:3090` (`.env.local`); produÃ§Ã£o sÃ³ via build Easypanel
- Menu lateral: sempre `logo-claro` (`surface="on-light"`)

## 2026-07-16 â€” Deploy Easypanel Soma

- Repo: `https://github.com/walkup-tec/soma-master.git` (`main`)
- DomÃ­nio painel: `https://app.somaconecta.com.br` â†’ porta **3000**
- Dockerfile + Nitro `node-server` (igual SV)
- Env: `D:\Soma\.env.easypanel` (nÃ£o commitado)
- Webhook: `https://app.somaconecta.com.br/api/chat/whatsapp-webhook`

## 2026-07-16 â€” Fix /app/chat â€œThis page didn't loadâ€

- Causa: cache `ensureChatSchema` pulava ALTER `webhook_public_base_url` + inbox importava `auth.server`
- Fix: migrations leves sempre; `currentUserId` no bootstrap
- Reiniciar Vite se a pÃ¡gina ainda falhar

## 2026-07-16 â€” Chatbot Inbox + IntegraÃ§Ã£o EVO

- Params do chatbot sÃ³ em Config â†’ **IntegraÃ§Ã£o EVO** (QR + webhook + IA + teste inbound)
- Inbox Chatwoot-like: Meus / NÃ£o atribuÃ­dos / Todos + cartÃ£o contato
- Refs: Chatwoot dashboard basics; BotConversa live chat
- LOG: `doc/LOG-2026-07-16__181500__chatbot-inbox-integracao-evo.md`

## 2026-07-16 â€” ChatBot UI cursor-pointer

- Abas EVO/IA + botÃµes nativos (QR, educaÃ§Ã£o IA) com `cursor-pointer`

## 2026-07-16 â€” EVO configurado no Soma (.env.local)

- Fonte: `D:\Waba\.env` (`EVO_API_*` â†’ `EVOLUTION_API_*`), instÃ¢ncia `soma-crm`
- `OPENAI_API_KEY` tambÃ©m copiada; `CHAT_WEBHOOK_SECRET` gerado
- `load-env-file.ts` passou a injetar `EVOLUTION_*` / `OPENAI_*` / `CHAT_*`
- Reiniciar Vite apÃ³s mudar `.env.local`

## 2026-07-16 â€” Fix import-protection ConfiguraÃ§Ãµes

- Causa: `getSession` / repos no route client de `configuracoes.tsx`
- Fix: `getChatbotSettingsLoaderFn` (RPC) + chat usa `getSystemSettingsFn`
- LOG: `doc/LOG-2026-07-16__175400__fix-configuracoes-import-protection.md`

## 2026-07-16 â€” Restore Chatbot + IA (pÃ³s-reimplant)

- Recurso recuperado do transcript (nÃ£o estava no git/backup logos)
- Rotas: `/app/chat`, `/app/chat/ia`, Config â†’ aba ChatBot, webhook `/api/chat/whatsapp-webhook`
- ConfiguraÃ§Ãµes: Radix preservado + aba ChatBot (URL `?tab=chatbot`)
- Env: `OPENAI_*`, `EVOLUTION_*` (`soma-crm`), `CHAT_WEBHOOK_SECRET`
- LOG: `doc/LOG-2026-07-16__160831__restore-chatbot-ia-pos-reimplant.md`
- Keywords: chat, evolution, openai, chatbot, restore

## 2026-07-16 â€” Reimplant zero SVâ†’Soma

- CÃ³digo base = Sinal Verde; preservados env, logos/favicon, cores style, logo.tsx, tema
- Dev: http://127.0.0.1:3090 â€” remote git `soma-master`
- LOG: `doc/LOG-2026-07-16__151700__reimplant-zero-sv-para-soma.md`
- `node_modules` fÃ­sico prÃ³prio (sem junction) â€” entry TanStack padrÃ£o
- Keywords: reimplant, logos, env, cores, node_modules prÃ³prio
- Acesse: http://127.0.0.1:3090/login

## Preservar sempre

| Item | Onde |
|------|------|
| Env | `.env.local` |
| Logos | `public/brand/logo-claro.png`, `logo-escuro.png` (+ svg) |
| Favicons | `public/favicon*.png`, `favicon-soma.png`, `favicon.ico` |
| Cores | `src/styles.css` â€” `#be1c6a` `#ecf759` `#2775e5` `#f5f5f5` |
| Logo component | `src/components/logo.tsx` + `src/lib/theme/soma-theme.ts` |
| Backup | `D:\Soma-reimplant-preserve-20260716-142637` |

