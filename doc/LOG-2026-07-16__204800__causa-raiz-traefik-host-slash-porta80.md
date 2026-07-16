# LOG — Causa raiz Traefik Soma (diagnose VPS)

**Data:** 2026-07-16 ~20:48

## Evidência (dump do usuário)

| Item | Valor |
|------|--------|
| App | `PORT=3000`, container Running (reinicia com frequência) |
| Service-0 (easypanel.host) | `url: http://soma-promotora_gestao-interno:80/` → **502** |
| Service-1 (custom) | `url: …:3000/` |
| Rule custom | `Host(\`app.somaconecta.com.br/\`)` — **barra no Host** → **404** |
| Env APP_URL | `app.somaconect.com.br` (**falta o "a"**) |
| Env | `PORT=80` e `PORT=3000` duplicados |
| Healthcheck Swarm | null |
| Probes no VPS | easy 502 / app 404 |

## Causa

1. Proxy do host padrão ainda aponta **:80**; Nitro escuta **:3000**.
2. Domínio custom com `/` dentro do `Host()` — Traefik não casa o hostname.
3. Typo `somaconect` vs `somaconecta` nas URLs do env.

Não é Traefik morto (WABA OK). Não forçar `easypanel-traefik`.

## Fix

- Script: `scripts/fix-soma-traefik-routers-vps.sh` (patch `main.yaml` + hot-reload)
- Painel: Domínios porta **3000**, hostname **sem** `/`; Env URLs com `somaconecta`; remover `PORT=80`
