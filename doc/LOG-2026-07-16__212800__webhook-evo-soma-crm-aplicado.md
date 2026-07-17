# LOG — Webhook Evolution `soma-crm` aplicado

**Data:** 2026-07-16 ~21:28

## Webhook

`https://app.somaconecta.com.br/api/chat/whatsapp-webhook`

## EVO

- Instância: `soma-crm` (state `open`)
- `POST /webhook/set/soma-crm` → OK (`enabled: true`)
- Eventos: `MESSAGES_UPSERT`, `CONNECTION_UPDATE`, `QRCODE_UPDATED`
- Header: `x-soma-webhook-secret`

## Validação

- `GET` no webhook → 401 (esperado sem secret)
- App login → 200
