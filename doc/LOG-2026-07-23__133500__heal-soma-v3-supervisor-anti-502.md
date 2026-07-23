# LOG — Heal Soma v3 supervisor anti-502

## Contexto
Após deploy, `app.somaconecta.com.br` ficou em 502. Existia heal v2 (watch+timer), mas faltava a camada **supervisor** (padrão WABA v6) para quando watch/timer morrem ou o Easypanel remove publish depois do 1º heal.

## Solução
- `scripts/heal-soma-gestao-vps.sh` → `heal-soma-gestao-2026-07-23-v3-supervisor-anti-502`
  - Watch + timer (~20s) + **supervisor** (~20s: `ensure` → reinstall se unidades mortas; burst se HTTPS≠200)
  - Novo comando: `ensure`
- Actions `heal-soma-on-deploy.yml` instala v3 e valida as 3 unidades
- Rule `.cursor/rules/soma-login-heal-pos-redeploy.mdc`
- Atualização `soma-traefik-estabilidade.mdc`

## Validar no VPS
```bash
/root/soma-infra/heal-soma-gestao-vps.sh install
systemctl is-active soma-gestao-heal-watch.service soma-gestao-heal.timer soma-gestao-heal-supervisor.timer
# active active active
curl -sS -o /dev/null -w "login:%{http_code}\n" --max-time 15 https://app.somaconecta.com.br/login
```

## Segurança
- Sem força Traefik; só publish + patch dinâmico YAML.
- Secret `VPS_SSH_PRIVATE_KEY` no Actions.

## Keywords
heal-soma, supervisor, v3, anti-502, 30300, watch, timer, pós-redeploy
