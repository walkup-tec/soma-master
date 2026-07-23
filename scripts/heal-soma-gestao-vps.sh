#!/bin/bash
# Heal Soma gestao-interno após Redeploy Easypanel (mesmo VPS/Traefik que WABA).
#
# Causas (REGISTRY WABA + incidente Soma 2026-07-16/17):
#   - BACKEND-OVERLAY-502: Easypanel escreve http://soma-promotora_gestao-interno:3000/
#     Traefik não alcança overlay → 502 no *.easypanel.host
#   - SOMA-HOST-SLASH-404: Host(`app.somaconecta.com.br/`) com barra → 404 Traefik
#   - Publish host :30300 some no redeploy
#
# Modelo canônico WABA v6: heal-waba-login-vps.sh (watch + timer + supervisor + burst).
# Doc Traefik: routing/dynamic = hot-reload — NUNCA force easypanel-traefik.
#   https://doc.traefik.io/traefik/getting-started/configuration-overview/
#
# Camadas:
#   1) watch      — docker events → burst no redeploy
#   2) timer      — a cada ~20s: run se needs_heal
#   3) supervisor — a cada ~20s: se watch/timer mortos → install; se HTTPS!=200 → burst
#
# Uso (root no srv1261237):
#   bash heal-soma-gestao-vps.sh run|burst|watch|ensure|install|status|check
#
# Versão: heal-soma-gestao-2026-07-23-v3-supervisor-anti-502
set -euo pipefail

VERSION="heal-soma-gestao-2026-07-23-v3-supervisor-anti-502"
LOG="${SOMA_HEAL_LOG:-/var/log/soma-gestao-heal.log}"
LOCK="${SOMA_HEAL_LOCK:-/var/run/soma-gestao-heal.lock}"
INSTALL_DIR="/root/soma-infra"
UNIT_DIR="/etc/systemd/system"
SERVICE="soma-gestao-heal.service"
TIMER="soma-gestao-heal.timer"
WATCH_SERVICE="soma-gestao-heal-watch.service"
SUPERVISOR_SERVICE="soma-gestao-heal-supervisor.service"
SUPERVISOR_TIMER="soma-gestao-heal-supervisor.timer"
SWARM_SERVICE="${SOMA_SWARM_SERVICE:-soma-promotora_gestao-interno}"
HOST_PORT="${SOMA_HOST_PUBLISHED_PORT:-30300}"
TARGET_PORT="${SOMA_TARGET_PORT:-3000}"
DOMAIN="${SOMA_PUBLIC_HOST:-app.somaconecta.com.br}"
EASY_HOST="${SOMA_EASYPANEL_HOST:-soma-promotora-app.achpyp.easypanel.host}"
MAIN_YAML="${TRAEFIK_MAIN_YAML:-/etc/easypanel/traefik/config/main.yaml}"
REPO_SCRIPTS="${SOMA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/soma-master/main/scripts}"
TIMER_SEC="${SOMA_HEAL_SEC:-20}"
SUPERVISOR_SEC="${SOMA_HEAL_SUPERVISOR_SEC:-20}"
BURST_ROUNDS="${SOMA_HEAL_BURST_ROUNDS:-20}"
BURST_SLEEP="${SOMA_HEAL_BURST_SLEEP:-5}"
BACKEND_URL="http://172.17.0.1:${HOST_PORT}/"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }

unit_active() {
  systemctl is-active --quiet "$1" 2>/dev/null
}

local_health_ok() {
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 6 \
    "http://127.0.0.1:${HOST_PORT}/api/health" 2>/dev/null || true)"
  [[ "$code" == "200" ]]
}

https_code() {
  local host="$1" path="${2:-/api/health}"
  curl -sS -o /dev/null -w '%{http_code}' --max-time 12 \
    --resolve "${host}:443:127.0.0.1" \
    "https://${host}${path}" 2>/dev/null || echo "000"
}

https_ok() {
  local code
  code="$(https_code "$1" "${2:-/api/health}")"
  [[ "$code" == "200" ]]
}

service_exists() {
  docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$SWARM_SERVICE"
}

publish_present() {
  docker service inspect "$SWARM_SERVICE" --format '{{json .Endpoint.Ports}}' 2>/dev/null \
    | grep -qE "\"PublishedPort\":\s*${HOST_PORT}"
}

ensure_host_publish() {
  if ! service_exists; then
    log "ERRO: serviço ${SWARM_SERVICE} ausente"
    return 1
  fi
  if publish_present && local_health_ok; then
    log "publish :${HOST_PORT} OK + local health 200"
    return 0
  fi
  log "Garantindo publish ${SWARM_SERVICE} :${HOST_PORT}->${TARGET_PORT}"
  docker service update --publish-rm "${HOST_PORT}" "$SWARM_SERVICE" >>"$LOG" 2>&1 || true
  docker service update --publish-rm "${HOST_PORT}:${TARGET_PORT}" "$SWARM_SERVICE" >>"$LOG" 2>&1 || true
  timeout 120 docker service update \
    --publish-add "published=${HOST_PORT},target=${TARGET_PORT},protocol=tcp,mode=ingress" \
    "$SWARM_SERVICE" >>"$LOG" 2>&1 || {
      log "ERRO: publish falhou"
      return 1
    }
  local i
  for i in $(seq 1 15); do
    sleep 2
    if local_health_ok; then
      log "OK local :${HOST_PORT}/api/health (tentativa ${i})"
      return 0
    fi
  done
  log "ERRO: local :${HOST_PORT} ainda down"
  return 1
}

# Patch dinâmico main.yaml — file provider hot-reload (sem force Traefik)
patch_traefik_backends() {
  if [[ ! -f "$MAIN_YAML" ]]; then
    log "ERRO: main.yaml ausente (${MAIN_YAML})"
    return 1
  fi
  local stamp bak
  stamp="$(date +%Y%m%d-%H%M%S)"
  bak="${MAIN_YAML}.bak-soma-heal-${stamp}"
  cp -a "$MAIN_YAML" "$bak"

  python3 - "$MAIN_YAML" "$BACKEND_URL" "$DOMAIN" <<'PY' || return 1
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
new_url = sys.argv[2]
domain = sys.argv[3]
t = path.read_text(encoding="utf-8")
orig = t

# Host com barra inválida (404 Traefik)
t = t.replace(f"Host(`{domain}/`)", f"Host(`{domain}`)")
t = t.replace(f'"main": "{domain}/"', f'"main": "{domain}"')

# Overlay Swarm → host gateway
for old in (
    "http://soma-promotora_gestao-interno:3000/",
    "http://soma-promotora_gestao-interno:80/",
):
    t = t.replace(old, new_url)

for svc in ("soma-promotora_gestao-interno-0", "soma-promotora_gestao-interno-1"):
    pattern = rf'("{svc}"\s*:\s*\{{[^\}}]*?"url"\s*:\s*")[^"]*(")'
    t, n = re.subn(pattern, rf"\1{new_url}\2", t, count=1, flags=re.S)

# entryPoints web/websecure → http/https nos routers do Soma (lição WABA 2026-07-10:
# router com entrypoint inexistente vira órfão → 404 SPA). Prefixo do key manda.
pos = 0
while True:
    m = re.search(r'"((?:https?-)[^"]*soma[^"]*)"\s*:\s*\{', t[pos:], re.I)
    if not m:
        break
    abs_start = pos + m.start()
    key = m.group(1)
    brace = t.find("{", abs_start)
    depth, end = 0, brace
    for j, ch in enumerate(t[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = j + 1
                break
    block = t[abs_start:end]
    ep = "https" if key.startswith("https-") else ("http" if key.startswith("http-") else None)
    if ep and re.search(r'["\'](web|websecure)["\']', block, re.I):
        nb = re.sub(r'"entryPoints"\s*:\s*\[[^\]]*\]', f'"entryPoints": ["{ep}"]', block, count=1, flags=re.S)
        if nb != block:
            t = t[:abs_start] + nb + t[end:]
            end = abs_start + len(nb)
    pos = end

if t != orig:
    path.write_text(t, encoding="utf-8")
    print(f"patched → {new_url}")
else:
    print("already ok")
PY
  log "Traefik backends/Host patch (backup ${bak})"
  return 0
}

needs_heal() {
  if ! local_health_ok; then return 0; fi
  if ! https_ok "$EASY_HOST"; then return 0; fi
  if ! https_ok "$DOMAIN" "/login"; then return 0; fi
  # Host slash residual no yaml
  if grep -qF "Host(\`${DOMAIN}/\`)" "$MAIN_YAML" 2>/dev/null; then return 0; fi
  if grep -qF "http://soma-promotora_gestao-interno:" "$MAIN_YAML" 2>/dev/null; then return 0; fi
  # entryPoints web/websecure em router do Soma (órfão → 404)
  if soma_router_has_bad_entrypoint; then return 0; fi
  return 1
}

# 0 (true) se algum router do Soma usa entryPoints web/websecure (deveria ser http/https)
soma_router_has_bad_entrypoint() {
  [[ -f "$MAIN_YAML" ]] || return 1
  python3 - "$MAIN_YAML" <<'PY' 2>/dev/null
import re, sys
from pathlib import Path
t = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
for m in re.finditer(r'"((?:https?-)[^"]*soma[^"]*)"\s*:\s*\{', t, re.I):
    brace = t.find("{", m.start())
    depth, end = 0, brace
    for i, ch in enumerate(t[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    block = t[m.start():end]
    ep = re.search(r'"entryPoints"\s*:\s*\[(.*?)\]', block, re.S)
    if ep and re.search(r'["\'](web|websecure)["\']', ep.group(1), re.I):
        sys.exit(0)
sys.exit(1)
PY
}

cmd_check() {
  echo "VERSION=${VERSION}"
  echo "local:$(curl -sS -o /dev/null -w '%{http_code}' --max-time 6 "http://127.0.0.1:${HOST_PORT}/api/health" 2>/dev/null || echo 000)"
  echo "easy:$(https_code "$EASY_HOST")"
  echo "app_login:$(https_code "$DOMAIN" "/login")"
  echo "publish:$(publish_present && echo yes || echo no)"
  if needs_heal; then echo "needs_heal:yes"; else echo "needs_heal:no"; fi
}

cmd_run() {
  mkdir -p "$(dirname "$LOG")"
  exec 9>"$LOCK"
  if ! flock -n 9; then
    log "run: outro heal em curso — skip"
    return 0
  fi
  if ! needs_heal; then
    log "run: já saudável — skip"
    return 0
  fi
  log "run: iniciando heal"
  ensure_host_publish || true
  if local_health_ok; then
    patch_traefik_backends || true
    sleep 8
  fi
  log "run: local=$(local_health_ok && echo 200 || echo down) easy=$(https_code "$EASY_HOST") app=$(https_code "$DOMAIN" "/login")"
}

cmd_burst() {
  mkdir -p "$(dirname "$LOG")"
  exec 9>"$LOCK"
  if ! flock -n 9; then
    log "burst: lock ocupado — skip"
    return 0
  fi
  log "burst: início (${BURST_ROUNDS}×${BURST_SLEEP}s)"
  local i
  for i in $(seq 1 "$BURST_ROUNDS"); do
    if local_health_ok && https_ok "$EASY_HOST" && https_ok "$DOMAIN" "/login"; then
      if ! grep -qF "http://soma-promotora_gestao-interno:" "$MAIN_YAML" 2>/dev/null \
        && ! grep -qF "Host(\`${DOMAIN}/\`)" "$MAIN_YAML" 2>/dev/null \
        && ! soma_router_has_bad_entrypoint; then
        log "burst OK rodada ${i}"
        return 0
      fi
    fi
    ensure_host_publish || true
    if local_health_ok; then
      patch_traefik_backends || true
    fi
    log "burst ${i}/${BURST_ROUNDS} easy=$(https_code "$EASY_HOST") app=$(https_code "$DOMAIN" "/login")"
    sleep "$BURST_SLEEP"
  done
  log "burst fim easy=$(https_code "$EASY_HOST") app=$(https_code "$DOMAIN" "/login")"
}

cmd_watch() {
  mkdir -p "$(dirname "$LOG")"
  log "watch ativo — eventos docker service=${SWARM_SERVICE}"
  docker events \
    --filter "type=service" \
    --filter "type=container" \
    --format '{{.Type}} {{.Action}} {{.Actor.Attributes.name}} {{.Actor.Attributes.com.docker.swarm.service.name}}' \
    2>>"$LOG" | while read -r etype eaction ename esvc; do
      case "$etype" in
        service)
          if [[ "$ename" == "$SWARM_SERVICE" ]] || [[ "$esvc" == "$SWARM_SERVICE" ]]; then
            case "$eaction" in
              update|create|remove)
                log "evento service ${eaction} — burst"
                ( sleep 2; bash "$0" burst ) >>"$LOG" 2>&1 &
                ;;
            esac
          fi
          ;;
        container)
          if [[ "$esvc" == "$SWARM_SERVICE" ]]; then
            case "$eaction" in
              start|die|kill)
                log "evento container ${eaction} — burst"
                ( sleep 3; bash "$0" burst ) >>"$LOG" 2>&1 &
                ;;
            esac
          fi
          ;;
      esac
    done
}

# Camada à prova de falha: revive unidades mortas + cura 502 sem depender de evento.
cmd_ensure() {
  mkdir -p "$(dirname "$LOG")"
  local dest="${INSTALL_DIR}/heal-soma-gestao-vps.sh"
  local need_reinstall=0

  if ! unit_active "$WATCH_SERVICE"; then
    log "ENSURE: ${WATCH_SERVICE} inativo — reativando"
    need_reinstall=1
  fi
  if ! unit_active "$TIMER"; then
    log "ENSURE: ${TIMER} inativo — reativando"
    need_reinstall=1
  fi
  if ! unit_active "$SUPERVISOR_TIMER"; then
    log "ENSURE: ${SUPERVISOR_TIMER} inativo — reativando"
    need_reinstall=1
  fi

  if [[ "$need_reinstall" -eq 1 ]]; then
    if [[ -x "$dest" ]]; then
      bash "$dest" install >>"$LOG" 2>&1 || true
    else
      systemctl enable --now "$WATCH_SERVICE" 2>/dev/null || true
      systemctl enable --now "$TIMER" 2>/dev/null || true
      systemctl enable --now "$SUPERVISOR_TIMER" 2>/dev/null || true
    fi
  fi

  # HTTPS degradado (login ou health) → burst imediato
  if ! https_ok "$DOMAIN" "/login" || ! https_ok "$DOMAIN" "/api/health" || ! local_health_ok; then
    log "ENSURE: path degradado — burst"
    bash "${BASH_SOURCE[0]}" burst || bash "${BASH_SOURCE[0]}" run || true
  fi
  return 0
}

install_units() {
  local dest="${INSTALL_DIR}/heal-soma-gestao-vps.sh"

  cat >"${UNIT_DIR}/${SERVICE}" <<EOF
[Unit]
Description=Soma gestao-interno heal (:${HOST_PORT} + Traefik backends pós-redeploy)
After=docker.service

[Service]
Type=oneshot
ExecStart=${dest} run
EOF

  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=Soma gestao heal a cada ${TIMER_SEC}s (anti 404/502 pós-redeploy Easypanel)

[Timer]
OnBootSec=20s
OnUnitActiveSec=${TIMER_SEC}s
AccuracySec=3s
Persistent=true

[Install]
WantedBy=timers.target
EOF

  cat >"${UNIT_DIR}/${WATCH_SERVICE}" <<EOF
[Unit]
Description=Soma gestao heal WATCH — docker events → burst no redeploy
After=docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=3
ExecStart=${dest} watch

[Install]
WantedBy=multi-user.target
EOF

  cat >"${UNIT_DIR}/${SUPERVISOR_SERVICE}" <<EOF
[Unit]
Description=Soma gestao heal SUPERVISOR — revive watch/timer + cura 502
After=docker.service

[Service]
Type=oneshot
ExecStart=${dest} ensure
EOF

  cat >"${UNIT_DIR}/${SUPERVISOR_TIMER}" <<EOF
[Unit]
Description=Soma gestao heal SUPERVISOR a cada ${SUPERVISOR_SEC}s (anti-queda permanente)

[Timer]
OnBootSec=30s
OnUnitActiveSec=${SUPERVISOR_SEC}s
AccuracySec=3s
Persistent=true

[Install]
WantedBy=timers.target
EOF
}

cmd_install() {
  [[ "$(id -u)" -eq 0 ]] || { echo "Execute como root"; exit 1; }
  mkdir -p "$INSTALL_DIR" "$(dirname "$LOG")"
  local dest="${INSTALL_DIR}/heal-soma-gestao-vps.sh"
  local src
  src="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
  if [[ -f "$src" ]] && [[ "$src" == *.sh ]]; then
    cp "$src" "$dest"
  else
    curl -fsSL "${REPO_SCRIPTS}/heal-soma-gestao-vps.sh" -o "$dest"
  fi
  sed -i 's/\r$//' "$dest" 2>/dev/null || true
  chmod +x "$dest"
  cp "$dest" /root/heal-soma-gestao-vps.sh
  chmod +x /root/heal-soma-gestao-vps.sh

  install_units
  systemctl daemon-reload
  systemctl enable --now "$TIMER"
  systemctl enable --now "$WATCH_SERVICE"
  systemctl enable --now "$SUPERVISOR_TIMER"
  log "install OK — timer=${TIMER_SEC}s watch=on supervisor=${SUPERVISOR_SEC}s"
  bash "$dest" burst || bash "$dest" run || true

  local ok=1
  unit_active "$WATCH_SERVICE" && log "OK ${WATCH_SERVICE}=active" || { log "ERRO ${WATCH_SERVICE}!=active"; ok=0; }
  unit_active "$TIMER" && log "OK ${TIMER}=active" || { log "ERRO ${TIMER}!=active"; ok=0; }
  unit_active "$SUPERVISOR_TIMER" && log "OK ${SUPERVISOR_TIMER}=active" || { log "ERRO ${SUPERVISOR_TIMER}!=active"; ok=0; }
  cmd_status
  [[ "$ok" -eq 1 ]] || exit 1
}

cmd_status() {
  echo "VERSION=${VERSION}"
  for u in "$WATCH_SERVICE" "$TIMER" "$SUPERVISOR_TIMER"; do
    echo -n "${u}: "
    systemctl is-active "$u" 2>/dev/null || echo "inactive"
  done
  echo "--- supervisor ---"
  systemctl status "$SUPERVISOR_TIMER" --no-pager 2>/dev/null | head -n 8 || echo "(supervisor não instalado)"
  cmd_check
  tail -n 20 "$LOG" 2>/dev/null || true
}

case "${1:-}" in
  run) cmd_run ;;
  burst) cmd_burst ;;
  watch) cmd_watch ;;
  ensure) cmd_ensure ;;
  install) cmd_install ;;
  status) cmd_status ;;
  check) cmd_check ;;
  *)
    echo "Uso: $0 run|burst|watch|ensure|install|status|check"
    exit 1
    ;;
esac
