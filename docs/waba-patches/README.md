# Patch WABA — relay Cloud API → ChatBot Soma

O App Meta do Drax tem **um** webhook. O WABA continua sendo o destino (`POST /webhooks/meta/whatsapp`). Para o ChatBot da Soma receber as respostas dos leads nos números oficiais conectados pelo Embedded Signup:

1. Copie `soma-chatbot-cloud-relay.ts` para `src/integrations/soma/soma-chatbot-cloud-relay.ts` no repositório WABA.
2. Em `src/index.ts`, ao lado das rotas `/integrations/soma/aquecedor-instances`:

```ts
import { registerSomaChatbotCloudRelayRoutes } from "./integrations/soma/soma-chatbot-cloud-relay";
registerSomaChatbotCloudRelayRoutes(app);
```

3. Em `src/integrations/meta-whatsapp/meta-whatsapp-webhook.service.ts`, no final de `processPostedEvent` (depois do loop, ainda com HTTP 200 para a Meta):

```ts
import { relaySomaChatbotCloudWebhook } from "../soma/soma-chatbot-cloud-relay";
// ...
void relaySomaChatbotCloudWebhook(payload);
```

4. Env no WABA (Easypanel):

- `SOMA_WABA_INTEGRATION_KEY` — a mesma do Soma
- `SOMA_CHAT_CLOUD_WEBHOOK_URL` — opcional; senão o Soma envia a URL no register (`https://app.somaconecta.com.br/api/chat/whatsapp-cloud-webhook`)

O Soma, ao concluir o Embedded Signup, chama `POST /integrations/soma/chatbot-cloud-numbers` e o WABA só reenvia eventos desses `phone_number_id`.
