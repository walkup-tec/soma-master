# Chat WhatsApp + IA — Soma

## Modelo adotado

Inbox leve **no próprio CRM** (não Chatwoot embutido), com:

| Camada | Escolha |
|--------|---------|
| Canal | [Evolution API](https://github.com/EvolutionAPI/evolution-api) (webhook + sendText) |
| IA | OpenAI Chat Completions (`gpt-4o-mini` default) |
| “Treino” | System prompt + base de conhecimento + exemplos few-shot (sem fine-tune) |
| Handover | Ao entrar/enviar mensagem, `ai_enabled=false` **nessa conversa** |
| Global | Switch `aiGlobalEnabled` em `/app/chat/ia` |

## Evolution compartilhada (Easypanel) + isolamento

O CRM usa o **mesmo** serviço Easypanel do WABA:

- Host: `https://walkup-evo-walkup-api.achpyp.easypanel.host`
- Swarm/porta interna: `walkup_evo-walkup-api` → `:30181`

**Regra de ouro:** cada app tem suas próprias instâncias. O Soma **só** opera em nomes com prefixo `soma-` (padrão `soma-crm`).

| Instância | App | Observação |
|-----------|-----|------------|
| `soma-crm` | Soma CRM | Criada para este projeto; QR no Configurações → ChatBot |
| `soma` | (legado / aquecedor) | **Não** usar no CRM — não sobrescrever |
| Demais (WABA/Drax/…) | WABA etc. | Intocadas pelo adapter Soma |

Proteções no código (`evolution.adapter.ts`):

1. `assertSomaOwnedInstance` — rejeita operação se `EVOLUTION_INSTANCE` não começa com `soma-`
2. `ensureSomaEvolutionInstance` — cria **apenas** a instância configurada (409 = já existe)
3. Webhook — `isWebhookForSomaInstance` ignora eventos de outras instâncias
4. Sem `logout`/`delete` em massa; webhooks só via `/webhook/set/{soma-crm}` quando houver URL pública

Refs oficiais:

- https://doc.evolution-api.com/v2/en/configuration/webhooks
- https://evolutionapi-evolution-api-90.mintlify.app/concepts/instances

## Env

```
OPENAI_API_KEY=
EVOLUTION_API_URL=https://walkup-evo-walkup-api.achpyp.easypanel.host
EVOLUTION_API_KEY=   # mesma global key do Easypanel / WABA
EVOLUTION_INSTANCE=soma-crm
CHAT_WEBHOOK_SECRET=
CHAT_PUBLIC_BASE_URL=   # HTTPS público do CRM (não localhost)
```

Webhook Evolution (quando `CHAT_PUBLIC_BASE_URL` estiver definido):  
`POST {CHAT_PUBLIC_BASE_URL}/api/chat/whatsapp-webhook` + eventos `MESSAGES_UPSERT`  
Header: `x-soma-webhook-secret`.

Em **dev local**, QR/conexão funcionam; inbound webhook só após URL pública (túnel ou deploy).

## Fluxo

1. Evolution → `POST /api/chat/whatsapp-webhook` (alias `/api/webhooks/evolution`)
2. Mensagem inbound salva + match cliente por telefone/WhatsApp
3. Se IA global **e** conversa com IA on → gera resposta e envia via Evolution
4. Atendente em `/app/chat` → **Entrar no atendimento** ou enviar texto → pausa IA local
5. Status CRM = etiqueta no header do chat
6. Nota → `crm.client_attendances` com prefixo `[WhatsApp]`

## UI

- `/app/configuracoes?tab=chatbot` — Integração EVO (QR) + Educação da IA
- `/app/chat` — inbox
- `/app/chat/ia` — educação da IA

## Permissão

Menu `chat` (Comercial). Master vê automaticamente. Atendente/Gerente nos defaults novos; categorias já salvas no banco precisam incluir `chat` em Configurações → Categorias.
