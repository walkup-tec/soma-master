# LOG — Heal Soma automático pós-deploy (GitHub Actions)

## Contexto

A suíte de estabilidade Traefik do Soma exigia um `install` manual no VPS. Pedido: eliminar o passo manual a cada deploy.

## Solução (padrão WABA)

Novo workflow `.github/workflows/heal-soma-on-deploy.yml`, espelho de `heal-waba-login-on-deploy.yml`:

- Gatilho: `push` em `main` (+ `workflow_dispatch` + `repository_dispatch`).
- Aguarda 45s (janela do build/redeploy Easypanel).
- SSH root no VPS (`appleboy/ssh-action`), baixa e roda `install` de:
  - `heal-soma-gestao-vps.sh` (publish :30300 + backend + entryPoints)
  - `soma-traefik-guard-vps.sh` (guard routers Soma)
- `install` é idempotente e recria watch + timer → depois do 1º run, o VPS se cura sozinho em TODO redeploy (docker events + timer), sem depender do Actions.
- Burst imediato + health final com retry (~4 min) para não dar falso vermelho enquanto o container ainda sobe.

## Pré-requisito (uma vez, no GitHub — não no VPS)

- Secret `VPS_SSH_PRIVATE_KEY` no repo `walkup-tec/soma-master` (mesma chave root usada pelo WABA).
- Opcional: `VPS_HOST` (default `72.60.51.127`).

## Por que resolve o "a cada deploy"

- O passo manual no VPS deixa de existir: o Actions instala/atualiza sozinho.
- A cura contínua não depende nem do Actions: `watch` (docker events) + `timer` no systemd reagem a qualquer redeploy futuro.

## Arquivos

- `+ .github/workflows/heal-soma-on-deploy.yml`
- `~ .cursor/rules/soma-traefik-estabilidade.mdc` (seção automático + fallback)

## Validação

- YAML do workflow revisado; usa o mesmo action/params do WABA (comprovado).
- Execução real só no GitHub após push (requer o secret configurado).

## Segurança

- Nenhuma chave no repo; usa secret do GitHub. SSH só root via chave.

## Palavras-chave

`github actions`, `heal-soma-on-deploy`, `VPS_SSH_PRIVATE_KEY`, `appleboy/ssh-action`, `pós-deploy`, `watch timer idempotente`
