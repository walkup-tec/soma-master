# LOG — Fix PORT=80 Easypanel / Nitro

**Data:** 2026-07-16 ~20:12

## Pedido

Screenshots: `app.somaconecta.com.br` 404 JSON + “Não seguro”; logs do container com `Listening on: http://localhost/` e `Server closed successfully` em loop.

## Diagnóstico

- URL sem porta no log Nitro/srvx = bind na porta **80**.
- Easypanel costuma setar `PORT=80`; Dockerfile/entrypoint antigo respeitavam isso.
- Domínio/Traefik do serviço aponta para **3000** → 502 no host `*.easypanel.host` e 404 no custom (router sem backend útil).
- Não é incidente Traefik “morto” (WABA landings 200 no mesmo VPS).

## Correção

- `docker-entrypoint.sh`: se `PORT` vazio/80/443 → `3000`; export `NITRO_PORT`/`NITRO_HOST`; log explícito.
- `Dockerfile`: `NITRO_PORT`/`NITRO_HOST` no runner.

## Validar após Redeploy

1. Logs devem mostrar: `soma-entrypoint: listening … :3000` e `Listening on: http://localhost:3000` (ou similar com :3000).
2. `https://soma-promotora-app.achpyp.easypanel.host/login` → 200.
3. `https://app.somaconecta.com.br/login` → CRM (cert ACME depois que o router+backend estabilizam).
