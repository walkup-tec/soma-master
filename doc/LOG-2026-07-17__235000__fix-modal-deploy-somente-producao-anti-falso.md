# LOG — Modal deploy só em produção + anti falso positivo

**Data:** 2026-07-17 23:50  
**Repo:** Soma-explore (`C:\Users\Usuario\Soma-explore`)  
**Parent SHA:** `2e9da33`

## Contexto

O overlay "ATUALIZANDO O SISTEMA" e o service worker de deploy podiam aparecer fora do host Easypanel de produção (ex.: localhost) ou por sinais genéricos (rede local, "Not Found"), gerando falso positivo.

## Critérios verificados / implementados

| Regra | Status |
|-------|--------|
| Modal/SW só em `app.somaconecta.com.br` | OK (`PRODUCTION_HOST` + early return) |
| Não-prod desregistra SW | OK (`unregisterLegacyServiceWorkers` + SW `activate` unregister) |
| Catch de rede ≠ overlay imediato | OK (`gateway: false` no catch) |
| `hasSeenHealthy` antes do overlay | OK (`startRecovery` / `confirmProductionDeployFailure`) |
| `looksLikeGatewayPayload` não casa "Not Found" genérico | OK (só `bad-gateway` / path Traefik) |
| SW v5 (`soma-deploy-shell-v5`, `?v=5`) | OK |

## Arquivos

- `src/lib/ui/deploy-resilience.ts`
- `public/sw-deploy-resilience.js`
- Este LOG + prepend em `doc/memoria.md`

## Nota para o usuário

- Se o modal apareceu **enquanto fazíamos deploy em produção** (`app.somaconecta.com.br`): **esperado**.
- Se apareceu em **localhost** (ou outro host): era **bug**, agora corrigido.

## Keywords

modal-deploy, sw-v5, app.somaconecta.com.br, hasSeenHealthy, anti-falso-positivo, bad-gateway, localhost
