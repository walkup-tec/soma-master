# LOG — Funil e WhatsApp + Números via aquecedor WABA

## Contexto
- Renomear submenu Marketing → **Funil e WhatsApp**
- Tela Números WhatsApp lista instâncias do aquecedor da conta `mozart.pmo@gmail.com` (padrão WABA)

## WABA
- `GET /integrations/soma/aquecedor-instances` + header `X-Soma-Waba-Key`
- Env: `SOMA_WABA_INTEGRATION_KEY`, `SOMA_WABA_OWNER_EMAIL` (default mozart.pmo@gmail.com)
- Bypass auth path no middleware

## Soma
- Menu/grupo **Funil e WhatsApp**
- Tabela: Quente (chamas), avatar, Número, Nome WhatsApp, Nome Instância, Contatos, Mensagens
- Poll ~45s; env `WABA_API_BASE_URL` + `SOMA_WABA_INTEGRATION_KEY`

## Config Easypanel (obrigatório nos dois apps)
Mesma chave nos dois:
- WABA: `SOMA_WABA_INTEGRATION_KEY`, `SOMA_WABA_OWNER_EMAIL=mozart.pmo@gmail.com`
- Soma: `WABA_API_BASE_URL=https://waba.draxsistemas.com.br`, `SOMA_WABA_INTEGRATION_KEY=<mesma>`

## Keywords
funil, whatsapp, aquecedor, numeros, waba, mozart.pmo, integração
