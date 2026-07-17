## 2026-07-17 — Tema escuro apagado pelo AppTopbar

- Causa: ``useState(false)`` + ``useEffect`` que fazia ``classList.toggle('dark', false)`` no mount → limpava o dark do bootstrap após reload (ex.: Atualizar status EVO).
- Fix: ler tema do DOM/localStorage; ``persistSomaTheme`` + ``data-theme-toggle``.
- Overlay Processando só aparece após Redeploy com ``f421c02+``; site 404/502 = heal Traefik primeiro.
- Keywords: app-topbar, dark mode, persistSomaTheme

## 2026-07-17 — Overlay Processando + tema pós-reload

- Forms POST mostram overlay “Processando…” (bootstrap sem React).
- Tema escuro reaplicado no head + pageshow (não volta ao claro após Atualizar status EVO).
- Keywords: processing overlay, soma-theme, FOUC, Integração EVO

## 2026-07-17 — Heal Traefik Soma permanente

- Estudo: agente Traefik + REGISTRY (`BACKEND-OVERLAY-502`, `LOGIN-30180-PUBLISH`, thrash).
- Causa Soma: Redeploy Easypanel reescreve overlay + Host com `/` + some `:30300`.
- Fix: ``scripts/heal-soma-gestao-vps.sh install`` (watch + timer 45s). REGISTRY ``SOMA-EASYPANEL-REWRITE``.
- Keywords: heal-soma, 404, 502, hostgw, 30300, easypanel rewrite

## 2026-07-16 — Login ENOTFOUND + UI login

- Login OK na URL; falha DB: `db.*.supabase.co` so AAAA (IPv6); Docker ENOTFOUND.
- Fix VPS: `fix-soma-supabase-socat-vps.sh` + `DATABASE_URL=...@172.17.0.1:6543` + `DATABASE_SSL_INSECURE=true`
- UI: painel `login-brand-panel` (degrade) + logo `on-light` (colorida)
- Keywords: ENOTFOUND, supabase ipv6, socat, login-brand-panel, logo-claro
## 2026-07-16 â€” SIGTERM apos Listening

- Listening OK; SIGTERM = Easypanel/Docker (nao Traefik morto).
- Alinhar proxy do painel a **3000** (como Sinal Verde) + `/api/health`.
- Keywords: `SIGTERM`, `proxy port`, `3000`, `health`
# MemÃƒÂ³ria Soma

## 2026-07-16 Ã¢â‚¬â€ Entrypoint CRLF (sem Listening)

- ApÃƒÂ³s echo `Nitro 0.0.0.0:80` o Node nÃƒÂ£o chegava a Listening (memÃƒÂ³ria ~13 MB, 502).
- Causa: CRLF no `docker-entrypoint.sh` Ã¢â€ â€™ `exec` quebra no Linux.
- Fix: `.gitattributes` eol=lf + `sed` no Dockerfile + `docker-start.mjs`.
- Keywords: `CRLF`, `entrypoint`, `Listening`, `index.mjs`

## 2026-07-16 Ã¢â‚¬â€ PORT Easypanel = porta do Traefik (nÃƒÂ£o forÃƒÂ§ar 3000)

- Sintoma: Nitro sobe e logo `Server closed successfully` (SIGTERM) + 502/404.
- Causa real: painel injeta `PORT=80` (= porta do domÃƒÂ­nio/Traefik). ForÃƒÂ§ar app em **3000** deixava Traefik sem backend Ã¢â€ â€™ healthcheck/orquestrador mata o container.
- Fix: escutar `PORT` do ambiente; imagem como root (bind :80); `docker-signal-log.mjs` loga SIGTERM.
- Painel: DomÃƒÂ­nio HTTP = **mesma** porta do log (`80` se raw PORT=80). NÃƒÂ£o misturar 80 no env e 3000 no domÃƒÂ­nio.
- Keywords: `PORT=80`, `SIGTERM`, `Server closed successfully`, `nitro`, `502`

## 2026-07-16 Ã¢â‚¬â€ (obsoleto) forÃƒÂ§ar Nitro 3000

- Tentativa `2bbfc76` forÃƒÂ§ou 3000; piorou o mismatch. SubstituÃƒÂ­da pelo fix acima.

## 2026-07-16 Ã¢â‚¬â€ Traefik / mesmo VPS que WABA

- **IP compartilhado:** `72.60.51.127` (Soma `*.achpyp.easypanel.host`, `app.somaconecta.com.br`, Evolution walkup, WABA).
- Traefik do WABA **jÃƒÂ¡ estÃƒÂ¡ de pÃƒÂ©** (`wabadisparos.com.br` 200). Problema atual Soma: host Easypanel **502** + domÃƒÂ­nio custom **404** Ã¢â€ â€™ app/domÃƒÂ­nio, nÃƒÂ£o Ã¢â‚¬Å“Traefik mortoÃ¢â‚¬Â.
- LiÃƒÂ§ÃƒÂµes WABA aplicam: entryPoints sÃƒÂ³ `http`/`https`; sem `force` Traefik; sem thrash de heals; backend preferir host gateway apÃƒÂ³s inspeÃƒÂ§ÃƒÂ£o.
- **NÃƒÂ£o** instalar heals WABA (`30180`/`30210`) para o Soma. Rule: `.cursor/rules/soma-traefik-mesmo-vps-waba.mdc`.
- Ordem: Redeploy atÃƒÂ© easypanel.host **/login = 200** Ã¢â€ â€™ domÃƒÂ­nio :3000 Ã¢â€ â€™ cert ACME.
- Keywords: `traefik`, `502`, `404 not-found`, `entrypoints`, `achpyp`, `72.60.51.127`, `waba-shared-vps`

## 2026-07-16 Ã¢â‚¬â€ Ambientes + logo menu

- Local fixo: `http://127.0.0.1:3090` (`.env.local`); produÃƒÂ§ÃƒÂ£o sÃƒÂ³ via build Easypanel
- Menu lateral: sempre `logo-claro` (`surface="on-light"`)

## 2026-07-16 Ã¢â‚¬â€ Deploy Easypanel Soma

- Repo: `https://github.com/walkup-tec/soma-master.git` (`main`)
- DomÃƒÂ­nio painel: `https://app.somaconecta.com.br` Ã¢â€ â€™ porta **3000**
- Dockerfile + Nitro `node-server` (igual SV)
- Env: `D:\Soma\.env.easypanel` (nÃƒÂ£o commitado)
- Webhook: `https://app.somaconecta.com.br/api/chat/whatsapp-webhook`

## 2026-07-16 Ã¢â‚¬â€ Fix /app/chat Ã¢â‚¬Å“This page didn't loadÃ¢â‚¬Â

- Causa: cache `ensureChatSchema` pulava ALTER `webhook_public_base_url` + inbox importava `auth.server`
- Fix: migrations leves sempre; `currentUserId` no bootstrap
- Reiniciar Vite se a pÃƒÂ¡gina ainda falhar

## 2026-07-16 Ã¢â‚¬â€ Chatbot Inbox + IntegraÃƒÂ§ÃƒÂ£o EVO

- Params do chatbot sÃƒÂ³ em Config Ã¢â€ â€™ **IntegraÃƒÂ§ÃƒÂ£o EVO** (QR + webhook + IA + teste inbound)
- Inbox Chatwoot-like: Meus / NÃƒÂ£o atribuÃƒÂ­dos / Todos + cartÃƒÂ£o contato
- Refs: Chatwoot dashboard basics; BotConversa live chat
- LOG: `doc/LOG-2026-07-16__181500__chatbot-inbox-integracao-evo.md`

## 2026-07-16 Ã¢â‚¬â€ ChatBot UI cursor-pointer

- Abas EVO/IA + botÃƒÂµes nativos (QR, educaÃƒÂ§ÃƒÂ£o IA) com `cursor-pointer`

## 2026-07-16 Ã¢â‚¬â€ EVO configurado no Soma (.env.local)

- Fonte: `D:\Waba\.env` (`EVO_API_*` Ã¢â€ â€™ `EVOLUTION_API_*`), instÃƒÂ¢ncia `soma-crm`
- `OPENAI_API_KEY` tambÃƒÂ©m copiada; `CHAT_WEBHOOK_SECRET` gerado
- `load-env-file.ts` passou a injetar `EVOLUTION_*` / `OPENAI_*` / `CHAT_*`
- Reiniciar Vite apÃƒÂ³s mudar `.env.local`

## 2026-07-16 Ã¢â‚¬â€ Fix import-protection ConfiguraÃƒÂ§ÃƒÂµes

- Causa: `getSession` / repos no route client de `configuracoes.tsx`
- Fix: `getChatbotSettingsLoaderFn` (RPC) + chat usa `getSystemSettingsFn`
- LOG: `doc/LOG-2026-07-16__175400__fix-configuracoes-import-protection.md`

## 2026-07-16 Ã¢â‚¬â€ Restore Chatbot + IA (pÃƒÂ³s-reimplant)

- Recurso recuperado do transcript (nÃƒÂ£o estava no git/backup logos)
- Rotas: `/app/chat`, `/app/chat/ia`, Config Ã¢â€ â€™ aba ChatBot, webhook `/api/chat/whatsapp-webhook`
- ConfiguraÃƒÂ§ÃƒÂµes: Radix preservado + aba ChatBot (URL `?tab=chatbot`)
- Env: `OPENAI_*`, `EVOLUTION_*` (`soma-crm`), `CHAT_WEBHOOK_SECRET`
- LOG: `doc/LOG-2026-07-16__160831__restore-chatbot-ia-pos-reimplant.md`
- Keywords: chat, evolution, openai, chatbot, restore

## 2026-07-16 Ã¢â‚¬â€ Reimplant zero SVÃ¢â€ â€™Soma

- CÃƒÂ³digo base = Sinal Verde; preservados env, logos/favicon, cores style, logo.tsx, tema
- Dev: http://127.0.0.1:3090 Ã¢â‚¬â€ remote git `soma-master`
- LOG: `doc/LOG-2026-07-16__151700__reimplant-zero-sv-para-soma.md`
- `node_modules` fÃƒÂ­sico prÃƒÂ³prio (sem junction) Ã¢â‚¬â€ entry TanStack padrÃƒÂ£o
- Keywords: reimplant, logos, env, cores, node_modules prÃƒÂ³prio
- Acesse: http://127.0.0.1:3090/login

## Preservar sempre

| Item | Onde |
|------|------|
| Env | `.env.local` |
| Logos | `public/brand/logo-claro.png`, `logo-escuro.png` (+ svg) |
| Favicons | `public/favicon*.png`, `favicon-soma.png`, `favicon.ico` |
| Cores | `src/styles.css` Ã¢â‚¬â€ `#be1c6a` `#ecf759` `#2775e5` `#f5f5f5` |
| Logo component | `src/components/logo.tsx` + `src/lib/theme/soma-theme.ts` |
| Backup | `D:\Soma-reimplant-preserve-20260716-142637` |



## 2026-07-17 07:34 — AppTopbar tema + 404 bad-gateway
- Fix tema: commit `110beb2` (nao iniciar dark=false). Overlay ja em commits anteriores.
- Site 404 `/api/errors/bad-gateway` = Traefik/publish :30300 — heal burst + Redeploy.
- Keywords: app-topbar, tema, heal-soma, bad-gateway


## 2026-07-17 07:39 — Licoes Traefik WABA
- Estabilidade WABA = anti-thrash (bootstrap+443+entrypoint), nao Traefik separado.
- Soma segue heal 45s + hostgw `:30300`.


## 2026-07-17 07:41 — Heal Soma VPS saudavel
- `local/easy/app_login:200` publish:yes needs_heal:no; timer+watch ativos.


## 2026-07-17 07:51 — Tema dark pos-status
- Causa: React hydrate limpa class dark. Fix `a873ac3` + status SPA.


## 2026-07-17 08:00 — Chat envio lento
- Optimistic UI + join skip + EVO 12s. Redeploy para validar.


## 2026-07-17 08:05 — Menu secoes
- Parceiros (vazio) + Producao propria (menus atuais). Keywords: MENU_SECTIONS, sidebar.


## 2026-07-17 08:08 — Inbox toggle IA global
- Botao IA no header do Inbox liga/desliga `aiGlobalEnabled`. Keywords: setChatAiGlobalEnabledFn.


## 2026-07-17 08:09 — Logo menu colorida
- `surface=brand` no sidebar. Keywords: logo-claro, Logo brand.


## 2026-07-17 08:11 — Icone IA conversa
- Toggle IA no thread: Sparkles. Keywords: Sparkles, IA on/off chat.


## 2026-07-17 08:13 — Sem botao Assumir
- openConversation faz join automatico. Keywords: joinChat, Assumir removido.


## 2026-07-17 08:18 — Vincular contato chat
- ChatContactPanel + createAndLinkChatClientFn. Keywords: produto, requiredFieldIds, status atendimento.


## 2026-07-17 08:20 — Produto cor/tag
- `ProductConfig.tag` + `color`; resolveProductTagLabel. Keywords: produto tag badge.

