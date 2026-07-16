# LOG — SIGTERM apos Listening + porta 3000

**Data:** 2026-07-16 ~20:28

## Evidencia

App sobe (CRLF ok): Listening em :80, depois `SIGTERM` + Server closed + exit 0.
Ainda 502 externo.

## Leitura

- Nao e Traefik WABA morto.
- SIGTERM = orquestrador Easypanel/Docker a parar o container (redeploy ou proxy port desalinhada / healthcheck).
- Sinal Verde (mesmo stack) usa proxy **3000**.

## Correcao

- Forcar listen **3000**; USER app; EXPOSE 3000
- `GET /api/health` → 200
- Painel: Domínios → porta proxy **3000** (mudar de 80)

Doc: https://easypanel.io/docs/services/app
