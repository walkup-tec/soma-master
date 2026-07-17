# LOG — Especialista infra: SIGTERM Soma

**Data:** 2026-07-16 ~20:40  
**Agente:** waba-infrastructure-specialist (via skill + subagente generalPurpose)

## Veredito

Não é Traefik “morto” (WABA 200 no mesmo VPS).  
App sobe (`Listening`); **SIGTERM** vem do Swarm/Easypanel.

Com `raw PORT painel='3000'` ainda há SIGTERM → **Env sozinho não define o proxy**. Na doc Easypanel o **proxy port** fica em **Domains & Proxy**.

SSH desta máquina: sem chave (`VPS_SSH_PRIVATE_KEY` só no GitHub Actions).

## Ação

1. Painel → Domínios → porta **3000** (foto/confirmação).
2. Colar `scripts/diagnose-soma-easypanel-vps.sh` no SSH Hostinger.
3. Imagem `d85f099`: HEALTHCHECK `/api/health` start-period 60s.
