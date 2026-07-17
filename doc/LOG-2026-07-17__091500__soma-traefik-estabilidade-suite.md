# LOG — Suíte de estabilidade Traefik do Soma (base WABA)

## Contexto

Usuário (com razão) cobrou: usar os arquivos comprovados do **WABA** como base para a estabilidade do Traefik do Soma, e transformar a lição em **memória reutilizável** (Rule + doc), não só remendo pontual. Gatilho: `app.somaconecta.com.br` mostrando `Cannot GET /api/errors/bad-gateway` (502 Traefik) após deploy.

## Estudo (arquivos WABA usados como base)

- `scripts/heal-waba-login-vps.sh` — modelo do heal (publish + backends + watch + timer + burst).
- `scripts/infra/traefik-443-watchdog-vps.sh` — watchdog do `:443` (camada compartilhada).
- `scripts/infra/traefik-entrypoint-guard-vps.sh` — entryPoints `http`/`https` + backend host-gateway (incidente 2026-07-10).
- `scripts/traefik-easypanel-bootstrap-vps.sh` — sobe Traefik / libera `:80/:443`.

## Diagnóstico da lacuna

O `heal-soma-gestao-vps.sh` já cobria publish `:30300`, backend overlay→host-gateway e Host-slash, **mas não** normalizava `entryPoints web/websecure → http/https` dos routers do Soma — exatamente a causa nº1 de 404 SPA no WABA (router órfão). O `:443`/Traefik em si é protegido pela camada **compartilhada** do WABA; o Soma não deve ter watchdog/bootstrap próprios (anti-thrash).

## Alterações

- **Novo** `scripts/soma-traefik-guard-vps.sh` (v1) — espelho do entrypoint-guard do WABA, escopo Soma:
  - `check` — detecta host-slash, backend-overlay e entryPoints `web/websecure` nos routers `*soma*`.
  - `fix` — normaliza entryPoints (prefixo `http-`/`https-` do key manda) + remove host-slash.
  - `fix-backend` — força URL dos services Soma para `http://172.17.0.1:30300/`.
  - `run` — orquestra check→fix→(502+local ok)→fix-backend; hot-reload por file watch, **sem force**.
  - `install` — timer systemd **3min** (anti-thrash) + `run`.
- **Reforçado** `scripts/heal-soma-gestao-vps.sh` → v2:
  - `patch_traefik_backends` agora também corrige entryPoints `web/websecure` dos routers Soma.
  - `needs_heal` + critério do `burst` passam a considerar `soma_router_has_bad_entrypoint`.
- **Nova Rule** `.cursor/rules/soma-traefik-estabilidade.mdc` (`alwaysApply`) — modelo em camadas + regras de ouro + install. (Antes só havia menção na memória a uma Rule inexistente.)

## Validação

- `bash -n` OK nos dois scripts.
- Teste da lógica Python com `main.yaml` de amostra: detecta 4 problemas (host-slash, backend-overlay, 2 entryPoints), corrige todos, **não** toca o router `https-waba_paginadevendas-0`, resultado final `OK`.
- Probe externo no momento: `app.somaconecta.com.br/login` 200, `/api/health` 200 (já recuperado).

## Install no VPS (uma vez, root — após push no soma-master/main)

```bash
for s in heal-soma-gestao-vps.sh soma-traefik-guard-vps.sh; do
  curl -fsSL "https://raw.githubusercontent.com/walkup-tec/soma-master/main/scripts/$s" -o "/tmp/$s"
  sed -i 's/\r$//' "/tmp/$s"; chmod +x "/tmp/$s"; "/tmp/$s" install
done
/root/soma-infra/soma-traefik-guard-vps.sh status
```

## Segurança

- Sem segredos nos scripts. Backup do `main.yaml` antes de cada patch (`*.bak-soma-*`).
- Nunca `--force` no `easypanel-traefik`; nunca `web/websecure`.

## Palavras-chave

`soma-traefik-guard`, `heal-soma`, `entryPoints`, `web websecure`, `host gateway 30300`, `bad-gateway`, `anti-thrash`, `main.yaml`, `easypanel`
