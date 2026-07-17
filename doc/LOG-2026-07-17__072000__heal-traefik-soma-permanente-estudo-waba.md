# LOG — Heal Traefik Soma permanente (estudo WABA + agente)

**Data:** 2026-07-17 ~07:20  
**Agente:** traefik-incident-specialist (skill) + REGISTRY + UCP Traefik

## Estudo prévio

| Fonte | Uso |
|-------|-----|
| Skill `traefik-incident-specialist` | Fluxo incidente + árvore causas |
| `doc/traefik-causes/REGISTRY.md` | BACKEND-OVERLAY-502, LOGIN-30180-PUBLISH, TRAEFIK-THRASH-443 |
| Rules `ucp-traefik-static-dynamic` / entrypoints | Sem force; http/https; hostgw |
| Doc oficial | https://doc.traefik.io/traefik/getting-started/configuration-overview/ — routing hot-reload |
| Modelo | `heal-waba-login-vps.sh` (watch + timer + burst) |

## Diagnóstico Soma

- Sintoma: `app.somaconecta.com.br` **404**; `*.easypanel.host` **502** pós-Redeploy; WABA 200
- Causa: Easypanel reescreve `main.yaml` (overlay + Host com `/`) + some publish `:30300`
- Não é entryPoints web/websecure neste caso

## Correção definitiva

- Script: `scripts/heal-soma-gestao-vps.sh` (`install|burst|run|watch|status`)
- REGISTRY: `SOMA-EASYPANEL-REWRITE`
- Rule Soma: `.cursor/rules/soma-traefik-heal-permanente.mdc`
- Timer **45s** (não thrash 20s em cascata com WABA)

## Install VPS (usuário)

Ver rule / resposta do agente.
