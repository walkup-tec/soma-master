## 2026-06-09 — Setup local Sinal Verde CRM

- **Repo:** https://github.com/walkup-tec/sinal-verde-pro (`main`)
- **Pasta:** `D:\CRM-SinalVerde`
- **Domínio prod (alvo):** acesso-sinalverde.com
- **DNS parking:** artemis.dns-parking.com / hermes.dns-parking.com

### Feito
- Git init + checkout `main` (commit base `4bb3cbe`)
- Bun 1.3.14 instalado; `bun install` OK
- Fix conflito rotas TanStack: `_app` → `app` (`7470816`, push `main`)
- `bun run build` OK
- Dev server rodando: **http://localhost:8081/** (8080 ocupado)
- `/login` HTTP 200, conteúdo Sinal Verde OK

### Logo oficial
- Arquivo: `logo-sinal-verde.png` (raiz do projeto)
- Usado em: `Logo` (login + sidebar), favicon (`public/`)
- Commit: `5260f74`

### Auth master
- Login: `mozart.sinalverde.com` (senha em hash PBKDF2 no código)
- Sessão criptografada (`SESSION_SECRET` em `.dev.vars` / Wrangler)
- `/app` exige login; demo "pular login" removido
- Commit auth: ver `git log -1`

### Configurações — categorias de usuário (2026-06-09)
- Toda categoria criada pelo master **já é** modelo de permissões (sem flag/toggle “padrão”)
- Campos: `id`, `name`, `menuIds` — no cadastro de usuário escolhe-se a categoria
- Helpers: `listAssignableCategories`, `resolveUserCategoryTemplate(categoryId)`

### Privilégios por categoria (2026-06-09)
- Sidebar e rotas filtradas por `menuIds` da categoria (ex.: Atendente só vê o habilitado)
- `MENU_ITEMS` é fonte única — novo menu entra automaticamente em Configurações → Categorias
- Configurações persistidas em `data/system-settings.json` (servidor)
- Sessão recalcula permissões a cada request (`getAuthSessionFn`)

### Usuários — gestão (2026-06-09)
- Menu **Gestão → Usuários** (`/app/usuarios`), apenas role `master`
- CRUD: criar (e-mail, senha, nome, categoria), excluir, reenviar senha (gera senha temporária)
- Login com **e-mail + senha**; master: `mozart@sinalverde.com` (aceita legado `mozart.sinalverde.com`)
- Persistência: `data/users.json` (gitignored)

### Clientes — importação e cadastro manual (2026-06-09)
- **Importar:** wizard 5 passos (produto → Excel → indexação → distribuição → exibição)
- **Cabeçalho na planilha:** etapa Arquivo pergunta se a 1ª linha é cabeçalho; sem cabeçalho usa `Coluna 1`, `Coluna 2`, etc.
- **Campo Banco:** opcional em todos os produtos (`client-fields`); opções em **Configurações → Bancos** (inputs de texto)
- **Importação grande (≥5 MB):** upload em chunks + processamento no servidor; job com barra de progresso (planilha INSS ~540k linhas)
- **Fix parse planilha grande (2026-06-09):** erro "corrompido no envio" era OOM no `XLSX.read` completo; import usa streaming XML (`xlsx-zip-stream.ts`)
- **Fix prévia (2026-06-10):** alerta "não foi possível ler a prévia" — `XLSX.read` removido da prévia; leitura só das primeiras linhas via XML stream (~4s)
- **Indexação import (2026-06-10):** colunas do Excel A–Z; coluna some do select ao mapear e volta ao desmarcar; Endereço completo → tipo logradouro, logradouro, número, complemento, bairro, cidade, UF; Tempo de Empresa (`tempo_empresa`); botão Cancelar importação (mantém já importados)
- **Novo cliente:** modal 3 passos (produto → dados obrigatórios/opcionais → distribuição)
- Distribuição compartilhada: todos / categorias / usuários específicos (`LeadDistributionForm`)
- Backend: `createManualClientFn`, `importClientsFn` → `data/clients.json`
- Tela: `/app/clientes` — botões **Novo cliente** e **Importar**

### Supabase (2026-06-11)
- Schema `crm` criado no Supabase (10 tabelas)
- `.env.local`: URL, chaves API, `DATABASE_URL` pooler `aws-1-us-east-1:6543`
- **Integrado:** `postgres.ts`, `seed.ts`, repositories (settings, users, clients, import jobs/uploads)
- Fallback JSON se `DATABASE_URL` ausente
- Scripts: `test-db-connection.ts`, `test-db-integration.ts`, `migrate-json-to-supabase.ts`
- Dependência: `postgres@3.4.9`

### Anexos de cliente (2026-06-09)
- Upload chunked (1 MB) qualquer tipo/tamanho → `data/client-attachments/` + `crm.client_attachments`
- UI: `ClientAttachmentsPanel` no modal atendimento e no ícone clipe
- Download streaming: `/api/client-attachments/{token}/download`

### Modal de atendimento (2026-06-09)
- Layout 2 colunas em modal largo (`max-w-6xl`): esquerda = dados indexados por grupo; direita = WhatsApp/Telefone (se mapeados), anexos placeholder, textarea + histórico
- Persistência: `crm.client_attendances` + `client-attendance.repository.ts`
- Server: `getClientDetailFn`, `listClientAttendancesFn`, `createClientAttendanceFn`

### Colunas e ações na listagem (2026-06-09)
- Tabela: Cliente, Produto, Status, Ação
- Ícones: calendário (agendar contato), conversa (modal atendimento placeholder), clipe (arquivos placeholder)
- Arquivos: `client-row-actions.tsx`, `client-action-modals.tsx`

### Listagem paginada clientes (2026-06-09)
- Problema: 127k registros carregados inteiros → sistema lento / timeout
- Fix: `listClientsPageForUser` com LIMIT/OFFSET, DTO enxuto (`ClientListItem`), busca por nome/CPF/telefone
- UI: 50 por página, paginação Anterior/Próxima, campo de busca com debounce
- Índices: `idx_clients_created_at`, `idx_client_assignments_user_client` (`ensure-client-indexes.ts`)

### Purge clientes importados (2026-06-09)
- Script `scripts/purge-imported-clients.ts`: remove `crm.clients`, `client_assignments`, `import_jobs` + zera `data/clients.json`
- Executado: 2000 clientes + 2000 assignments + 4 jobs no Supabase; JSON local também zerado (tinha 539946 registros antigos)

### Otimização importação 540k (2026-06-09)
- **Problema:** barra em 0% por muito tempo; ~1 INSERT por cliente + assignment no Postgres
- **Fix:** bulk insert (`tx(rows, cols...)`) em lotes de 5000; parse XML síncrono com backpressure; `total` definido antes do streaming; updates do job a cada 2,5s
- Arquivos: `clients.repository.ts`, `xlsx-zip-stream.ts`, `import-job.service.ts`

### Agenda = tabela Clientes + status configurável (2026-06-09)
- **Agenda:** mesma tabela Cliente / Produto / Status / Ação (`ClientsDataTable` + `ClientListActionLayer`)
- **API:** `listScheduledClientsForUser` retorna `ClientListItem[]` (com flags de agenda/atendimento/anexo)
- **Modal atendimento:** select "Status de atendimento" persiste via `updateClientStatusFn`
- **Configurações:** aba "Status de atendimento" (`crm.attendance_statuses`, seed defaults)
- Componentes compartilhados: `clients-data-table.tsx`, `client-list-action-layer.tsx`, `attendance-statuses-settings.tsx`
- `bun run build` OK

### Limite de clientes (2026-06-09 → 2026-07-14)
- Antes: `CLIENT_DATABASE_LIMIT = 1000` bloqueava importação/cadastro
- **Agora:** `CLIENT_DATABASE_LIMIT = null` — sem teto; importação aceita qualquer quantidade
- Script `trim-clients-to-limit.ts` exige limite explícito na CLI
- Keywords: CLIENT_DATABASE_LIMIT, importação ilimitada

### Remoção menus Documentos e Relatórios (2026-06-09)
- Removidos de `MENU_ITEMS`, sidebar, topbar e categorias padrão
- Rotas `/app/documentos` e `/app/relatorios` excluídas
- `system-settings.json` atualizado (também limpou `remarketing` obsoleto)
- `bun run build` OK

### Filtro Com agenda — Clientes (2026-06-09)
- Botão **Com agenda** na tela Clientes (junto a Sem/Com atendimento)
- Query `schedule=with` em `ClientsPageQuery`; SQL `exists` em `crm.client_schedules`
- Modo disco: filtra por `hasSchedule` em `client-activity.repository`
- **Limpar filtros** também zera `schedule`
- `bun run build` OK

### Pendente
- UI kanban/tabela/lista conforme `display.mode` (hoje listagem simples)
- Refatorar wizard de importação para reutilizar `LeadDistributionForm` (opcional)
- `wrangler login` (Cloudflare) — requer browser do usuário
- Deploy Cloudflare Workers + domínio `acesso-sinalverde.com`
- Apontar nameservers do domínio para Cloudflare (após conta/zona)

## 2026-07-14 - Retomada no Cursor

- Workspace desejado: `D:\CRM-SinalVerde` (repo sinal-verde-pro)
- Continuar trabalho a partir do estado local (Supabase + clientes + usuarios + config); muitas mudancas ainda nao commitadas
- Abriu sessao pedindo: `Vamos trabalhar nesse projeto`

## 2026-07-14 - Login bloqueado por Supabase morto

- Erro: ENOTFOUND tenant `postgres.nxuxclelzngykskehala`
- `DATABASE_URL` comentada em `.env.local` / `.dev.vars` → fallback local
- Login master local: `mozart@sinalverde.com`
- Log: `LOG-2026-07-14__131421__fix-login-enotfound-supabase.md`

## 2026-07-14 - Supabase restaurado (saida de pausa)

- Projeto `nxuxclelzngykskehala` voltou; `DATABASE_URL` reativada
- Teste: `test-db-connection.ts` OK (14 tabelas crm)
- Log: `LOG-2026-07-14__132125__reativar-supabase-pos-pausa.md`

## 2026-07-14 - Categorias: exclusao e multi-select

- Bug: lixeira nao parecia excluir (UI sem otimismo + erro silencioso)
- Feat: checkboxes + exclusao em lote; Master protegida
- Log: `LOG-2026-07-14__135345__fix-categorias-exclusao-multiselect.md`

## 2026-07-14 - Perf settings (lentidao create/delete)

- Causa: rewrite completo + N+1 SQL para us-east-1
- Fix: save por secao + CTE/JSON batch + cache + warm DB
- Benchmark categorias ~850ms (antes ~1.7s+/acoes)
- Log: `LOG-2026-07-14__140344__perf-settings-save-incremental.md`

## 2026-07-14 - Campo data ultima parcela
- Novo campo financeiro `data_ultima_parcela` + mascara dd/mm/aaaa
- Log: LOG-2026-07-14__141035__campo-data-ultima-parcela.md


## 2026-07-14 - Produtos multi-select exclusao
- Checkboxes + exclusao em lote (padrao categorias)
- Log: LOG-2026-07-14__141228__produtos-exclusao-multiselect.md


## 2026-07-14 - Fix duplicate product_fields
- ON CONFLICT + fila de save em produtos
- Log: LOG-2026-07-14__141535__fix-product-fields-duplicate-key.md


## 2026-07-14 - Clientes selecao filtro e bulk
- Data criacao, Selecao Filtro, agenda/produto/exclusao em lote, multi-produto
- Log: LOG-2026-07-14__145942__clientes-filtro-selecao-acoes-lote.md


## 2026-07-14 - Calendario nos filtros e agendamento
- DatePicker + DateRangePicker; periodo createdFrom/createdTo
- Log: LOG-2026-07-14__152217__date-pickers-calendario.md


## 2026-07-14 - Fix lentidao sidebar
- Removido invalidate 5s; cache enrich; preload+staleTime
- Log: LOG-2026-07-14__152639__fix-lentidao-navegacao-sidebar.md


## 2026-07-14 — Fix Agenda crash
- **Problema:** `/app/agenda` quebrava (error boundary) após multi-select em Clientes
- **Causa:** `ClientsDataTable` exigia props de seleção; Agenda não passava
- **Fix:** seleção opcional + `product_ids` na query da agenda
- **Keywords:** agenda, ClientsDataTable, selectedIds, didn't load, filter=today

## 2026-07-14 — E-mail boas-vindas SMTP
- Criacao de usuario envia e-mail com dados + senha (MAIL_MODE=smtp / Gmail)
- Reenvio de senha tambem e-mail
- Keywords: mail, smtp, boas-vindas, nodemailer, MAIL_FROM, createUserFn

## 2026-07-14 — Import: header Fone + Agendamento Contato
- Fix cabecalho Excel repetido (sharedStrings/rPh + collapse token)
- Etapa Distribuicao: Agendamento Contato com DatePicker
- Keywords: import, FoneFone, excel-headers, scheduleContactDate, Agendamento Contato

## 2026-07-14 — Filtro Status em Clientes
- Select de status de atendimento (settings.attendanceStatuses)
- Keywords: filtro status, attendanceStatuses, clients-screen

## 2026-07-14 — Removido Sinal IA
- Card da sidebar removido
- Keywords: Sinal IA, sidebar, Sparkles


## 2026-07-14 — Status → historico
- Troca de status gera attendance no mesmo padrao do historico
- Keywords: status, historico, createClientAttendance, Registrar atendimento


## 2026-07-14 — Cor dos status
- color picker em Status de atendimento
- tags coloridas em Clientes/Agenda
- Keywords: status color, StatusBadge, attendance_statuses.color


## 2026-07-14 — Contato: so copiar
- Modal atendimento: sem Ligar/Abrir WhatsApp; so Copiar (e-mail, telefone, whatsapp) + Copiar todos
- Keywords: copiar contato, attendance dialog


## 2026-07-14 — Retorno Automatico
- Status com dias → agenda automatica no usuario que atribuiu
- Keywords: autoReturnDays, Retorno Automatico, saveClientSchedule


## 2026-07-14 — Filtro Data do Registro
- Presets: hoje, ontem, 7/15/30 dias, personalizada (range) — base no dia atual SP
- Keywords: Data do Registro, registrationPreset, resolveRegistrationDateRange, hoje

## 2026-07-14 — Máscaras cadastro cliente
- Renda/valores: R$ milhar (`maskCurrencyBrl`); fone/WhatsApp DDD; UF select BR; e-mail válido
- Centro: `ClientFieldInput` + `src/lib/masks/*` + `brazil-ufs`
- Keywords: mascara moeda, telefone DDD, UF, email, ClientFieldInput

## 2026-07-14 — Máscara CPF
- `maskCpf` → `000.000.000-00` em `ClientFieldInput` (`src/lib/masks/br-cpf.ts`)
- Keywords: mascara CPF, cpfDigits

## 2026-07-14 — Remarketing (agenda por período)
- Stub → lista real: clientes com `client_schedules` do usuário (mesmo escopo da Agenda)
- Filtros UI: Hoje, Semana (7 dias), Próximos 15, Próximos 30
- Semana/15/30: de amanhã até +7/+15/+30 (não incluem hoje)
- Keywords: remarketing, listRemarketingFn, contact_date, next15

## 2026-07-14 — Filtros produto/status multi
- Clientes: produto e status com `MultiSelectFilter`; API `productIds`/`statuses`
- Keywords: multiselect, productIds, statuses, clientes filtros

## 2026-07-14 — Agenda/Remarketing pós-importação
- Agendamento na importação usa atendente da distribuição (`resolveScheduleActor`)
- Lista: `sch.user_id` **ou** `client_assignments` do usuário logado
- Keywords: schedule actor, importação agenda, remarketing assignment

## 2026-07-14 — Kanban
- Menu `/app/kanban`: Status | Semanal | Mensal; card → modal atendimento
- Escopo: clientes atribuídos (master vê todos); `listKanbanFn`
- Keywords: kanban, Semanal, Mensal, attendanceStatuses

## 2026-07-14 — Import sem escolha de layout
- Removido passo Exibição (Tabela/Lista/Kanban); display padrão `table` + campos mapeados
- Leads aparecem em listas (Clientes/Agenda/etc.) e no menu Kanban
- Keywords: import wizard, Exibição, displayMode

## 2026-07-14 — Dashboard indicadores reais
- `getDashboardSummaryFn` escopo usuário/master: totais, leads hoje, agenda, por status, últimos
- Remove mocks do `/app`
- Keywords: dashboard, getDashboardSummaryForUser, KPIs

## 2026-07-14 — Kanban na categoria (auto)
- `ensureKanbanMenuForClientCategories`: quem tem `clientes` ganha `kanban` no normalize
- Recarregar/navegar atualiza sessão (menu na sidebar)
- Keywords: kanban menu, categoria Comercial, menuIds

## 2026-07-14 — Kanban Semanal / Mensal em tela
- Semanal: 7 colunas (seg–dom) na mesma tela
- Mensal: calendário — cada linha = 1 semana (7 dias), mês inteiro visível
- Keywords: kanban semanal, kanban mensal, calendário semanas

## 2026-07-14 — Kanban filtros + grade dinâmica
- Status: Dia / Semana (seg–dom) / 15 / 30 dias; colunas com cards só; grid linhas×cols na viewport
- Semanal/Mensal: multi-select de status (vazio = todos)
- Keywords: kanban filtro, period preset, layoutKanbanStatusGrid, MultiSelectFilter

## 2026-07-14 — Clientes Ações: Alterar status
- Modal bulk: opção Alterar status na seleção (filtro ou IDs)
- `bulkUpdateStatusFn` + nota de atendimento + retorno automático se configurado
- Keywords: bulkUpdateStatusFn, alterar status lote, Seleção Filtro

## 2026-07-14 — Fix Kanban status (Comercial 01)
- Causa: limit 800 cortava leads; ~1000 `novo` recentes escondiam outros status
- Limit 5000 + join lateral agenda; Status default **Todos**
- Keywords: kanban limit, Comercial 01, status faltando

## 2026-07-14 — Menu Kanban → Comercial
- `MENU_ITEMS` kanban: group `Comercial` (com Remarketing/Agenda)
- Keywords: menu kanban Comercial

## 2026-07-14 — Tela Inicial por categoria
- Campo `homeMenuId` na categoria; UI **Tela Inicial** filtra pelos menus permitidos
- Login → `firstAllowedAppPath` usa a tela configurada
- Keywords: homeMenuId, tela inicial, tipo de usuário

## 2026-07-14 — Dashboard pie tooltip
- Hover: quantidade + %; fontes menores (legend 10px)
- Keywords: pie tooltip, percentual status

