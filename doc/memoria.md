## 2026-07-17 18:12 — Modal de deploy alinhado à paleta SOMA
- Removidas cores/efeitos herdados da DRAX: roxo, ciano, verde, glow e gradientes multicoloridos.
- Modal usa somente magenta `#be1c6a`, lima `#ecf759`, azul `#2775e5` e neutros SOMA.
- Tipografia Manrope no conteúdo e Sora no título; comportamento de recuperação não mudou.
- Prettier, ESLint e build client+SSR OK. LOG: `doc/LOG-2026-07-17__181200__fix-modal-deploy-paleta-soma.md`.
- Keywords: modal deploy, paleta SOMA, remover DRAX, atualizando sistema.

## 2026-07-17 17:45 — Boas-vindas e-mail + WhatsApp (usuário/parceiro)
- Template Soma Promotora (Usuário=e-mail, Senha=senha ou código GE1234); HTML + WhatsApp (`*negrito*`).
- `notifyWelcomeChannels` após `createUserFn` e `createPartnerFn`; canais em paralelo; falha não desfaz cadastro.
- SMTP Easypanel (`SMTP_PASS`, fallback `SMP_PASS`); WA via Evolution `soma-crm` + DDI 55.
- Usuário interno sem WhatsApp → só e-mail. Toast informa status dos canais.
- Build OK. LOG: `doc/LOG-2026-07-17__174500__boas-vindas-email-whatsapp-usuario-parceiro.md`.
- Keywords: boas-vindas, SMTP, WhatsApp Evolution, parceiro, usuário.

## 2026-07-17 17:29 — Código de acesso do parceiro gerado pelo sistema + copiar
- Sistema gera os 4 dígitos sozinho (`crypto.getRandomValues`): ao abrir novo cadastro e ao definir/trocar categoria (alias muda junto).
- Campo readOnly com prefixo do alias; botões RefreshCw (gerar novo) e Copy (copia código completo, ex. GE1234, com toast).
- Em edição, voltar à categoria original limpa o campo (mantém senha atual); gerar novo código troca a senha.
- Build + lint OK. LOG: `doc/LOG-2026-07-17__172900__codigo-acesso-parceiro-gerado-automatico-copiar.md`.
- Keywords: código acesso gerado, copiar código, alias SB GE SE CN AE, crypto random.

## 2026-07-17 15:15 — Máscaras e obrigatoriedade no formulário Parceiros
- Máscaras em CPF/CNPJ, telefone, WhatsApp, CEP e chave PIX por tipo; UF via select.
- E-mail obrigatório com validação de formato (`isFilledValidEmail`) e feedback visual.
- Todos os campos configurados obrigatórios (exceto complemento e senha na edição); exige ao menos 1 banco e 1 menu.
- Build/lint OK. LOG: `doc/LOG-2026-07-17__151500__parceiros-mascaras-validacao-obrigatorios.md`.
- Keywords: máscara parceiros, e-mail válido, campos obrigatórios, PIX CEP CPF.

## 2026-07-17 14:55 — Área Parceiros implementada
- Nova rota `/app/parceiros`: abas Ativos/Inativos/Bloqueados, busca, Produção, bancos, paginação, tabela e ações.
- Cadastro PF/PJ completo com categoria, login, PIX, endereço/ViaCEP, bancos e menus individuais.
- Backend: `partner_profiles` + CTE recursiva, `user_menu_permissions`, `partner_banks`, `partner_events`; Master raiz e criador como pai fixo.
- Pai gerencia descendentes; filho não vê outros ramos; hierarquia não altera clientes/chat/agenda.
- Inativo/bloqueado não autentica; bloqueio exige motivo; CPF/CNPJ globalmente único.
- Build client+SSR, ESLint e servidor local HTTP 200: OK. Schema Postgres provisionado sem erros.
- LOG: `doc/LOG-2026-07-17__145500__implementacao-parceiros-hierarquia.md`.
- Keywords: parceiros implementado, CTE recursiva, permissões individuais, ViaCEP, histórico bloqueio.

## 2026-07-17 14:20 — Requisitos da área Parceiros
- Hierarquia recursiva: criador é pai fixo; ator vê a si e descendentes, nunca ancestrais/irmãos/outros ramos; Master é raiz.
- Hierarquia vale somente para cadastros da área Parceiros, sem ampliar clientes/chat/agenda/outros dados operacionais.
- Pai pode gerenciar qualquer descendente do ramo; CPF/CNPJ é único globalmente.
- Qualquer parceiro ativo com permissão `Cadastrar parceiros` pode criar filhos.
- Campos separados: categoria (Substabelecido/Gerente/Suporte/Atendente) e pessoa (PF/PJ).
- Estados: Ativo, Inativo/Desativado e Bloqueado; bloqueio exige motivo e todos os eventos são auditados.
- Permissões serão individuais por parceiro e não podem exceder as do pai; bancos/produção começam com front preparado.
- Mapeamento: seção Parceiros é placeholder; UI reaproveita Clientes/Usuários; backend evoluirá `crm.users` + CTE + permissões individuais + eventos; sem ampliar escopo operacional.
- LOG: `doc/LOG-2026-07-17__142000__requisitos-arquitetura-parceiros-hierarquia.md`.
- Keywords: parceiros, pai filho, parent_user_id, descendentes, permissões individuais, bloqueio, ViaCEP.

## 2026-07-17 14:00 — Gatilho de deploy de todo estado pendente
- `main` e `origin/main` estavam em `6987dda`; demais modificações aparentes eram somente LF/CRLF (`NO_CONTENT_DIFF`).
- Commit/push de deploy `540fedf`; produção continuou HTTP 200 com asset antigo `/assets/index-CBqzy7be.js` nas 20 tentativas por ~5 min.
- Código está integralmente no remoto; troca em produção não confirmada porque o Easypanel/Maker não iniciou ou não concluiu o build automático.
- GitHub CLI local sem autenticação; validar conclusão e SHA pelo título do deploy no Maker.
- LOG: `doc/LOG-2026-07-17__140000__deploy-tudo-pendente-producao.md`.
- Keywords: deploy pendente, trigger Easypanel, Maker, LF CRLF.

## 2026-07-17 13:55 — Download de anexo WhatsApp sem extensão
- Mídia inbound salvava `fileName` sem extensão (`imagem-recebida`) → download do modal saía em "formato estranho".
- Novo `src/lib/files/file-name-extension.ts` (`ensureFileNameExtension`): aplica extensão pelo MIME no salvamento inbound, na cópia chat→anexo, no handler de download e na rota `/api/chat/media` (corrige inclusive anexos antigos ao servir).
- Build OK. LOG: `doc/LOG-2026-07-17__135500__fix-download-anexo-whatsapp-sem-extensao.md`.
- Keywords: download sem extensão, formato estranho, ensureFileNameExtension, content-disposition.

## 2026-07-17 13:44 — Observação do contato na barra lateral
- `chat_conversations.contact_note` guarda nota interna da conversa, exibida somente no painel lateral.
- Editor com limite 1.000, contador, Salvar, Ctrl/Cmd+Enter e feedback discreto; disponível com ou sem cliente CRM.
- Fluxo separado em server function, service e repository; migration idempotente; build client+SSR OK.
- LOG: `doc/LOG-2026-07-17__134400__chat-observacao-contato-barra-lateral.md`.
- Keywords: observação contato, contact_note, nota interna conversa.

## 2026-07-17 13:38 — Card do chat reorganizado
- Card agora mostra contato + ícone `Sparkles` para ativar/pausar IA, todos os produtos, divisor fino e status.
- Removidos atendente atribuído e prévia da mensagem; espaçamento e foco por teclado refinados.
- Toggle centralizado e sincroniza lista/cabeçalho; build client+SSR OK.
- LOG: `doc/LOG-2026-07-17__133800__chat-card-contato-produtos-status-ia.md`.
- Keywords: chat card, produtos, status, Sparkles IA.

## 2026-07-17 13:03 — Favicon errado ao abrir mídia do chat
- Navegador usa `GET /favicon.ico` em respostas não-HTML; o `.ico` na raiz era legado.
- Novo `scripts/build-favicon-ico.mjs` regenera `public/favicon.ico` (PNG-in-ICO 16/32/48 do ícone Soma).
- LOG: `doc/LOG-2026-07-17__130300__favicon-ico-raiz-midia-chat.md`.
- Keywords: favicon.ico, aba imagem, PNG-in-ICO.

## 2026-07-17 11:03 — Chat: anexar mídia ao cliente, PDF e Abrir
- Webhook Evolution agora reconhece `documentMessage` PDF; domínio ganhou `messageType: document`.
- Imagem/PDF recebido mostra `Abrir` e `Anexar imagem/PDF`; toast discreto e estado `Anexado`.
- Anexo é copiado no servidor para `client-attachments`, com validação conversa-cliente/usuário e dedupe por `source_chat_media_id`.
- JPG/PNG/WEBP/PDF até 10 MB; rota de mídia autenticada permanece inline.
- Build client+SSR OK. LOG: `doc/LOG-2026-07-17__110300__chat-anexar-midia-pdf-abrir.md`.
- Keywords: documentMessage, PDF chat, anexar mídia cliente, source_chat_media_id, abrir mídia.

## 2026-07-17 11:05 — Envio de imagem no chat estava lento
- Causa: chunks em série + bytea 10 MB bloqueante no Postgres + releitura do banco + Evolution síncrona (30s).
- Fix: `readFileInChunksParallel` (concorrência 4); bytea persiste em background; `readChatImageAsDataUrl`/`openChatImageReadStream` leem disco local primeiro; Evolution em background com mensagem de sistema no thread em caso de falha.
- Build OK. LOG: `doc/LOG-2026-07-17__110500__chat-envio-imagem-lento-otimizacao.md`.
- Keywords: imagem lenta, upload paralelo, sendMedia background, local-first.

## 2026-07-17 10:45 — Múltiplos produtos no cliente pelo chat
- Painel de conversa vinculada mostra tags dos produtos e select `Adicionar produto` (só disponíveis).
- `addChatClientProductFn` → `addProductToClient`: autorização por usuário/master, valida produto, `crm.client_products` sem duplicata e histórico WhatsApp.
- Conversa enriquecida com `clientProductIds` (principal + extras).
- Corrigido retorno Evolution das server functions: UI recebe só `{ok,error}`, sem `raw: unknown`.
- LOG: `doc/LOG-2026-07-17__104500__chat-cliente-multiplos-produtos.md`.
- Keywords: cliente multi-produto, client_products, addChatClientProductFn.

## 2026-07-17 10:30 — Margem label/campo no atendimento
- Modal cliente: grupos `Status de atendimento` e `Registrar atendimento` agora usam `space-y-3` (título menos colado ao input).
- LOG: `doc/LOG-2026-07-17__103000__margem-label-input-atendimento.md`.

## 2026-07-17 10:20 — Imagens no Chat WhatsApp (envio + recebimento)
- Evolution v2: `sendMedia` (base64) + webhook `MESSAGES_UPSERT base64=true`; fallback `getBase64FromMediaMessage`.
- UI: JPG/PNG/WEBP até 10 MB, preview, legenda, upload chunks 1 MiB, balão com imagem.
- Persistência: `crm.chat_media` (bytea separado) + metadados em `chat_messages`; cache `/app/data/chat-media`; rota autenticada `/api/chat/media/:id`.
- Segurança: MIME allowlist, tamanho/chunks, sessão Chat, nosniff, dedupe waMessageId.
- Build client+SSR OK; lint sem erros.
- LOG: `doc/LOG-2026-07-17__102000__chat-whatsapp-imagens-envio-recebimento.md`.
- Keywords: Evolution sendMedia, imageMessage, chat_media, WhatsApp imagens.

## 2026-07-17 10:00 — Chat "Detalhes" abre modal do cliente
- Cartão Contato: "Abrir no CRM" → botão "Detalhes" com `ClientAttendanceDialog` (mesmo modal da tela Clientes).
- LOG: `doc/LOG-2026-07-17__100000__chat-detalhes-modal-cliente.md`.

## 2026-07-17 09:55 — Separação das grandes seções do menu
- `PARCEIROS` e `PRODUÇÃO PRÓPRIA` agora têm cabeçalho em bloco (fundo/borda/sombra) e divisória forte entre seções; subgrupos seguem secundários.
- LOG: `doc/LOG-2026-07-17__095500__separacao-secoes-menu.md`.
- Keywords: sidebar, seções menu, hierarquia visual.

## 2026-07-17 09:50 — Chat ativo só com contorno rosa
- Lista do Inbox remove `bg-primary-soft` do item ativo; usa borda `primary`, fundo/hover transparentes (melhor no dark).
- LOG: `doc/LOG-2026-07-17__095000__chat-ativo-contorno-rosa.md`.
- Keywords: chat ativo, contorno rosa, dark mode.

## 2026-07-17 09:45 — Ícone WhatsApp no histórico
- Notas com prefixo `[WhatsApp]` exibem ícone vetorial verde `#25D366`; prefixo fica armazenado, mas oculto na UI (sem migração).
- LOG: `doc/LOG-2026-07-17__094500__historico-icone-whatsapp.md`.
- Keywords: histórico, WhatsApp icon, origem atendimento.

## 2026-07-17 09:40 — Header Contato espelha nome/WhatsApp
- Painel Vincular ao CRM emite `onDraftChange`; cabeçalho Contato mostra rascunho em tempo real e zera ao trocar/vincular.
- Telefone da conversa (chave WhatsApp) não muda no banco; após vincular vale `clientName`.
- LOG: `doc/LOG-2026-07-17__094000__contato-header-espelha-nome-whatsapp.md`.

## 2026-07-17 09:35 — Heal Soma automático pós-deploy (Actions)
- Novo `.github/workflows/heal-soma-on-deploy.yml` (espelho WABA): push main → SSH VPS → `install` (idempotente) + burst da suíte (heal + guard).
- Elimina passo manual: após 1º run, VPS se cura sozinho em todo redeploy (watch docker events + timer). Actions não é dependência contínua.
- Pré-req único (no GitHub, não no VPS): secret `VPS_SSH_PRIVATE_KEY` no repo soma-master (mesma chave root do WABA); opcional `VPS_HOST`.
- LOG: `doc/LOG-2026-07-17__093500__heal-soma-on-deploy-workflow.md`.
- Keywords: github actions, heal-soma-on-deploy, VPS_SSH_PRIVATE_KEY, pós-deploy.

## 2026-07-17 09:30 — Regra IA geral/individual + takeover manual
- Geral ON/OFF aplica em massa; depois cada chat pode sobrescrever mesmo com geral OFF.
- Envio manual sempre pausa só a conversa atual; abrir conversa apenas atribui o atendente e preserva IA.
- Conversa nova herda último estado geral; webhook revalida IA antes de publicar para evitar corrida com takeover.
- Build client+SSR OK; lint sem erros.
- LOG: `doc/LOG-2026-07-17__093000__regra-ia-geral-individual-takeover.md`.
- Keywords: IA geral, IA individual, takeover manual, setAiEnabledForAllConversations.

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

## 2026-07-17 09:15 — Suíte estabilidade Traefik Soma (base WABA)
- Novo `scripts/soma-traefik-guard-vps.sh` (entryPoints http/https + backend host-gw :30300 + host sem barra; timer 3min anti-thrash).
- `heal-soma-gestao-vps.sh` → v2: também corrige entryPoints web/websecure dos routers Soma (needs_heal + burst).
- Nova Rule `.cursor/rules/soma-traefik-estabilidade.mdc` (alwaysApply) — modelo em camadas: :443/bootstrap/entrypoint-guard = camada COMPARTILHADA WABA; Soma só heal + guard. NUNCA force Traefik; nunca web/websecure; nunca heals :30180/:30210 no Soma.
- Validado: bash -n OK + teste Python (4 fixes, router WABA intacto).
- Install VPS (após push): curl heal-soma-gestao + soma-traefik-guard → `install`.
- LOG: `doc/LOG-2026-07-17__091500__soma-traefik-estabilidade-suite.md`.
- Keywords: soma-traefik-guard, entryPoints, host gateway 30300, bad-gateway, anti-thrash.

## 2026-07-17 09:01 — bad-gateway pós-deploy (recuperado)
- `app.somaconecta.com.br` mostrou JSON `Cannot GET /api/errors/bad-gateway` após push `a0fccae` — Traefik/publish `:30300`, não bug do app.
- Checagem externa: `/login` 200, `/api/health` 200. Se voltar: `heal-soma-gestao-vps.sh burst`.
- LOG: `doc/LOG-2026-07-17__090100__soma-bad-gateway-pos-deploy.md`.

## 2026-07-17 08:53 — IA da conversa + regra global off
- Toggle da conversa igual ao global (Sparkles verde/contorno). Global off ⇒ `disableAiForAllConversations()` desliga IA de todas as conversas (server + front).
- LOG: `doc/LOG-2026-07-17__085300__ia-conversa-icon-regra-global-off.md`.
- Keywords: Sparkles conversa, disableAiForAllConversations, IA global off.

## 2026-07-17 08:49 — Toggle global de IA
- Inbox usa somente `Sparkles`: verde quando ligado; transparente com contorno neutro quando desligado.
- LOG: `doc/LOG-2026-07-17__084900__fix-toggle-ia-global-icon.md`.
- Pendente: commit/push somente quando solicitado.
- Keywords: IA global, Sparkles, toggle IA, Inbox WhatsApp.

## 2026-07-17 15:33 — Parceiros: seções, senha com alias e Corban
- Permissões agora começam pela seleção independente de `Parceiros` e/ou `Produção própria`; os submenus aparecem conforme as seções marcadas.
- Senha de parceiro = 4 números; o backend gera e hasheia o código completo com alias: `SB`, `GE`, `SE`, `CN` e `AE`.
- O código completo é exibido uma única vez após criar/trocar senha, com botão para copiar. Troca de categoria exige nova senha.
- Nova categoria `corban`/`cat-corban`; migration idempotente atualiza o check do PostgreSQL.
- Build, ESLint e HTTP local 200 validados. Commit/push pendentes.
- LOG: `doc/LOG-2026-07-17__153300__parceiros-secoes-alias-senha-corban.md`.
- Keywords: partner sections, menu permissions, corban, CN, senha 4 dígitos, partnerCategoryAlias.

## 2026-07-17 17:25 — Fix CNPJ 403 (User-Agent) + fallback Minha Receita
- Causa: BrasilAPI responde 403 ao UA padrão do Node fetch; server function sempre falhava.
- Fix: UA explícito `SomaCRM/1.0` + alternância BrasilAPI ↔ minhareceita.org (4 tentativas, backoff).
- LOG: `doc/LOG-2026-07-17__172500__fix-cnpj-403-user-agent-fallback.md`.
- Keywords: CNPJ 403, user-agent node, minhareceita fallback.

## 2026-07-17 17:05 — Overlay "Atualizando o sistema" pós-deploy
- Modelo WABA portado: bootstrap `deploy-resilience.ts` no `__root.tsx` + SW `public/sw-deploy-resilience.js`.
- `/api/health` devolve `serverBootId`; watcher 8s, poll 2s, 3 sondas estáveis ou drift de bootId ⇒ reload.
- SW serve shell em cache quando navegação recebe 502–504 ou JSON `bad-gateway` do Traefik — nunca mais tela JSON.
- Ativo só em produção (somaconecta.com.br). LOG: `doc/LOG-2026-07-17__170500__overlay-atualizando-sistema-pos-deploy.md`.
- Keywords: deploy overlay, sw-deploy-resilience, serverBootId, bad-gateway.

## 2026-07-17 15:50 — Histórico só com bloqueio prévio
- Item **Histórico** do dropdown de parceiros só aparece quando `hasBlockHistory` (exists em `crm.partner_events` com `action='blocked'`).
- Campo novo em `PartnerRecord`; calculado na listagem e no `findVisiblePartner`.
- Build + ESLint + HTTP local 200 validados. Commit/push pendentes.
- LOG: `doc/LOG-2026-07-17__155000__historico-parceiro-somente-com-bloqueio.md`.
- Keywords: hasBlockHistory, partner_events blocked, histórico condicional.

## 2026-07-17 15:43 — Autopreenchimento PJ pela BrasilAPI
- No formulário PJ, o CNPJ agora antecede a razão social e consulta a BrasilAPI por uma server function autenticada.
- Adapter isolado com timeout, uma repetição para falhas transitórias e contrato normalizado.
- Preenche razão social, contato e endereço sem apagar campos quando a API não possui o dado; situação não ativa gera aviso.
- Build client/SSR, ESLint, endpoint oficial e HTTP local validados. Commit/push pendentes.
- LOG: `doc/LOG-2026-07-17__154300__integracao-brasilapi-cnpj-parceiros.md`.
- Keywords: BrasilAPI, CNPJ, PJ, lookupPartnerCnpjFn, brasil-api-cnpj.adapter.

