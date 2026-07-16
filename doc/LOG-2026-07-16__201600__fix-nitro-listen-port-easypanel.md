# LOG — Nitro deve escutar a PORT do Easypanel

**Data:** 2026-07-16 ~20:16

## Evidência (screenshot)

```
soma-entrypoint: listening Nitro on 0.0.0.0:3000 (raw PORT was '80')
Listening on: http://localhost:3000/
Server closed successfully.
```

Memória ~12 MB, CPU 0% → processo morto. Host ainda 502; domínio 404.

## Causa raiz

1. Easypanel injeta `PORT=80` alinhado ao alvo Traefik/domínio.
2. Commit anterior remapou para 3000.
3. Traefik/healthcheck batem em **80** → falha → **SIGTERM** → srvx: `Server closed successfully` → restart loop.

Doc: https://nitro.build/deploy/runtimes/node — `PORT` / `NITRO_PORT`.

## Correção

- Entrypoint: **não** remapear 80→3000; export `NITRO_PORT=$PORT`.
- Dockerfile: `USER` root (bind :80), `EXPOSE 80`, default `PORT=80`.
- `docker-signal-log.mjs`: log explícito de SIGTERM.

## Painel

Domínio `app.somaconecta.com.br` → HTTP porta **igual** ao log (80). Redeploy após pull `main`.
