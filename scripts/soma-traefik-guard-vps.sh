#!/bin/bash
# Guard Traefik do Soma (app.somaconecta.com.br) — mesmo VPS/Traefik do WABA.
#
# Base comprovada: WABA scripts/infra/traefik-entrypoint-guard-vps.sh
#   (incidente 2026-07-10: router com entryPoints web/websecure = órfão → 404 SPA).
#
# O que este guard garante nos routers/services do Soma no main.yaml (Easypanel):
#   1) entryPoints  web/websecure  ->  http/https        (senão router órfão → 404)
#   2) backend URL  overlay Swarm  ->  http://172.17.0.1:30300/  (host gateway = alcançável)
#   3) Host(`app.somaconecta.com.br/`) com barra  ->  sem barra   (senão 404 Traefik)
#
# Modelo de config Traefik (NÃO misturar):
#   - static/install (entryPoints, providers)  -> mudar raro; sem force
#   - dynamic/routing (routers/services/TLS no main.yaml) -> patch + hot-reload (file watch)
#   Doc:
#     https://doc.traefik.io/traefik/getting-started/configuration-overview/
#     https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/
#     https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
#
# ANTI-THRASH: timer de 3min (não 20-45s). O :443/Traefik em si é protegido pela
# camada COMPARTILHADA do WABA (bootstrap + 443-watchdog + entrypoint-guard global).
# NÃO force easypanel-traefik. NÃO instalar heals de :30180/:30210 do WABA aqui.
#
# Uso (root no srv1261237):
#   bash soma-traefik-guard-vps.sh check|fix|fix-backend|run|install|status
#
# Versão: soma-traefik-guard-2026-07-17-v1
set -euo pipefail

VERSION="soma-traefik-guard-2026-07-17-v1"
CFG="${TRAEFIK_MAIN_YAML:-/etc/easypanel/traefik/config/main.yaml}"
LOG="${SOMA_TRAEFIK_GUARD_LOG:-/var/log/soma-traefik-guard.log}"
LOCK="${SOMA_TRAEFIK_GUARD_LOCK:-/var/run/soma-traefik-guard.lock}"
INSTALL_DIR="/root/soma-infra"
UNIT_DIR="/etc/systemd/system"
SERVICE="soma-traefik-guard.service"
TIMER="soma-traefik-guard.timer"
DOMAIN="${SOMA_PUBLIC_HOST:-app.somaconecta.com.br}"
EASY_HOST="${SOMA_EASYPANEL_HOST:-soma-promotora-app.achpyp.easypanel.host}"
SWARM_SERVICE="${SOMA_SWARM_SERVICE:-soma-promotora_gestao-interno}"
HOST_PORT="${SOMA_HOST_PUBLISHED_PORT:-30300}"
BACKEND_URL="${SOMA_BACKEND_URL:-http://172.17.0.1:${HOST_PORT}/}"
WATCH_SLEEP="${SOMA_TRAEFIK_WATCH_SLEEP:-10}"
TIMER_SPEC="${SOMA_TRAEFIK_GUARD_TIMER:-3min}"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }

# NÃO use `curl ... || echo 000` — o -w já imprime 000 e o || duplicaria (000000).
http_code() {
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 "$@" 2>/dev/null || true)"
  [[ -n "$code" ]] || code="000"
  printf '%s\n' "$code"
}

local_ok() {
  local code
  code="$(http_code "http://127.0.0.1:${HOST_PORT}/api/health")"
  [[ "$code" == "200" ]]
}

https_code() {
  local host="$1" path="${2:-/login}"
  http_code --resolve "${host}:443:127.0.0.1" "https://${host}${path}"
}

# check: 0 se os routers do Soma estão sãos no disco (entryPoints/backend/host)
cmd_check() {
  [[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; return 2; }
  python3 - "$CFG" "$DOMAIN" "$EASY_HOST" "$SWARM_SERVICE" <<'PY'
import re, sys
from pathlib import Path

cfg, domain, easy_host, svc = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
text = Path(cfg).read_text(encoding="utf-8", errors="replace")
problems = []

# 1) Host com barra
if f"Host(`{domain}/`)" in text or f"Host(`{easy_host}/`)" in text:
    problems.append("host-trailing-slash")

# 2) backend overlay (nome do serviço Swarm) em vez de host gateway
if re.search(rf'"url"\s*:\s*"http://{re.escape(svc)}[:/]', text):
    problems.append("backend-overlay")

# 3) entryPoints web/websecure em routers do Soma
#    Varre blocos de router cujo key contém 'soma' e valida o array entryPoints.
for m in re.finditer(r'"((?:https?-)?[^"]*soma[^"]*)"\s*:\s*\{', text, re.I):
    key = m.group(1)
    brace = text.find("{", m.start())
    depth, end = 0, brace
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    block = text[m.start():end]
    ep = re.search(r'"entryPoints"\s*:\s*\[(.*?)\]', block, re.S)
    if ep and re.search(r'["\'](web|websecure)["\']', ep.group(1), re.I):
        problems.append(f"entrypoints:{key}")

if problems:
    print("PROBLEMS " + " ".join(sorted(set(problems))))
    sys.exit(1)
print("OK")
sys.exit(0)
PY
}

# fix: normaliza entryPoints + host-slash dos routers do Soma (hot-reload via file watch)
cmd_fix() {
  [[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; return 2; }
  [[ "$(id -u)" -eq 0 ]] || { log "ERRO: fix precisa root"; return 2; }
  cp -a "$CFG" "${CFG}.bak-soma-guard-$(date +%Y%m%d-%H%M%S)"
  python3 - "$CFG" "$DOMAIN" "$EASY_HOST" <<'PY'
import re, sys
from pathlib import Path

cfg, domain, easy_host = sys.argv[1], sys.argv[2], sys.argv[3]
path = Path(cfg)
text = path.read_text(encoding="utf-8")
orig = text
changes = 0

# Host com barra inválida
for h in (domain, easy_host):
    b = f"Host(`{h}/`)"
    if b in text:
        text = text.replace(b, f"Host(`{h}`)")
        changes += 1
        print(f"FIX host-slash {h}")

# entryPoints em routers Soma: prefixo do key manda (http-* -> http, https-* -> https)
def fix_router(m):
    global changes, text
    key = m.group(1)
    brace = text.find("{", m.start())
    depth, end = 0, brace
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    block = text[m.start():end]
    if key.startswith("https-"):
        ep = "https"
    elif key.startswith("http-"):
        ep = "http"
    else:
        return  # sem prefixo confiável, não arrisca
    nb = re.sub(r'"entryPoints"\s*:\s*\[[^\]]*\]', f'"entryPoints": ["{ep}"]', block, count=1, flags=re.S)
    if nb != block:
        text = text[:m.start()] + nb + text[end:]

# itera manualmente (texto muda a cada fix)
i = 0
while True:
    m = re.search(r'"((?:https?-)[^"]*soma[^"]*)"\s*:\s*\{', text[i:], re.I)
    if not m:
        break
    abs_start = i + m.start()
    # reconstroi match no texto absoluto
    mm = re.match(r'"((?:https?-)[^"]*soma[^"]*)"\s*:\s*\{', text[abs_start:], re.I)
    key = mm.group(1)
    brace = text.find("{", abs_start)
    depth, end = 0, brace
    for j, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = j + 1
                break
    block = text[abs_start:end]
    ep = "https" if key.startswith("https-") else ("http" if key.startswith("http-") else None)
    if ep:
        nb = re.sub(r'"entryPoints"\s*:\s*\[[^\]]*\]', f'"entryPoints": ["{ep}"]', block, count=1, flags=re.S)
        if nb != block and re.search(r'["\'](web|websecure)["\']', block, re.I):
            text = text[:abs_start] + nb + text[end:]
            changes += 1
            print(f"FIX entrypoints {key} -> [{ep}]")
            end = abs_start + len(nb)
    i = end

if text != orig:
    path.write_text(text, encoding="utf-8")
print(f"changes={changes}")
PY
  log "fix entryPoints/host aplicado (file watch ~${WATCH_SLEEP}s)"
}

# fix-backend: força url dos services do Soma para host gateway
cmd_fix_backend() {
  [[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; return 2; }
  [[ "$(id -u)" -eq 0 ]] || { log "ERRO: fix-backend precisa root"; return 2; }
  cp -a "$CFG" "${CFG}.bak-soma-backend-$(date +%Y%m%d-%H%M%S)"
  python3 - "$CFG" "$BACKEND_URL" "$SWARM_SERVICE" <<'PY'
import re, sys
from pathlib import Path

cfg, url, svc = sys.argv[1], sys.argv[2], sys.argv[3]
url = url.rstrip("/") + "/"
path = Path(cfg)
text = path.read_text(encoding="utf-8")
changes = 0

# overlay (nome do serviço) -> host gateway
for old in (f"http://{svc}:3000/", f"http://{svc}:80/"):
    if old in text:
        text = text.replace(old, url)
        changes += 1
        print(f"URL {old} -> {url}")

# services nomeados soma-*-0/1: força url
for m in list(re.finditer(r'"([^"]*soma[^"]*-[01])"\s*:\s*\{', text, re.I)):
    key = m.group(1)
    pat = rf'("{re.escape(key)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    new, n = re.subn(pat, rf"\g<1>{url}\2", text, count=1)
    if n:
        text = new
        changes += 1
        print(f"URL service {key} -> {url}")

path.write_text(text, encoding="utf-8")
print(f"backend_changes={changes}")
PY
  log "fix-backend aplicado (URL ${BACKEND_URL}); file watch ${WATCH_SLEEP}s"
  sleep "$WATCH_SLEEP"
}

cmd_run() {
  mkdir -p "$(dirname "$LOG")"
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK"
    flock -n 9 || { log "outro guard em execução — skip"; return 0; }
  fi

  local status
  status="$(cmd_check || true)"
  local easy app
  easy="$(https_code "$EASY_HOST" "/api/health")"
  app="$(https_code "$DOMAIN" "/login")"
  log "run: check=${status} easy=${easy} app=${app} local=$(local_ok && echo 200 || echo down)"

  if [[ "$status" == "OK" ]] && [[ "$app" == "200" ]] && [[ "$easy" == "200" ]]; then
    return 0
  fi

  # entryPoints/host no disco
  if [[ "$status" != "OK" ]]; then
    cmd_fix || true
    sleep "$WATCH_SLEEP"
  fi

  # 502/503/504 com app local OK → backend overlay: força host gateway
  app="$(https_code "$DOMAIN" "/login")"
  if [[ "$app" =~ ^(502|503|504)$ ]] && local_ok; then
    log "run: HTTPS ${app} + local :${HOST_PORT} OK → fix-backend"
    cmd_fix_backend || true
  fi

  app="$(https_code "$DOMAIN" "/login")"
  easy="$(https_code "$EASY_HOST" "/api/health")"
  log "run: fim easy=${easy} app=${app}"
}

cmd_install() {
  [[ "$(id -u)" -eq 0 ]] || { echo "Execute como root"; exit 1; }
  mkdir -p "$INSTALL_DIR" "$(dirname "$LOG")"
  local dest="${INSTALL_DIR}/soma-traefik-guard-vps.sh"
  local src
  src="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
  if [[ -f "$src" ]] && [[ "$src" == *.sh ]]; then
    cp "$src" "$dest"
  else
    curl -fsSL "https://raw.githubusercontent.com/walkup-tec/soma-master/main/scripts/soma-traefik-guard-vps.sh" -o "$dest"
  fi
  sed -i 's/\r$//' "$dest" 2>/dev/null || true
  chmod +x "$dest"
  cp "$dest" /root/soma-traefik-guard-vps.sh
  chmod +x /root/soma-traefik-guard-vps.sh

  cat >"${UNIT_DIR}/${SERVICE}" <<EOF
[Unit]
Description=Soma Traefik guard (entryPoints http/https + backend :${HOST_PORT} + host sem barra)
After=docker.service

[Service]
Type=oneshot
ExecStart=${dest} run
EOF

  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=Soma Traefik guard a cada ${TIMER_SPEC} (anti-thrash; Traefik :443 = camada WABA)

[Timer]
OnBootSec=90
OnUnitActiveSec=${TIMER_SPEC}
AccuracySec=20s
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now "$TIMER"
  rm -f "$LOCK" 2>/dev/null || true
  log "install OK — timer=${TIMER_SPEC} ${VERSION}"
  bash "$dest" run || true
  systemctl status "$TIMER" --no-pager | head -12 || true
  echo "INSTALLED=${VERSION} timer=${TIMER_SPEC} path=${dest}"
}

cmd_status() {
  echo "VERSION=${VERSION}"
  systemctl is-active "$TIMER" 2>/dev/null || echo "timer:inactive"
  echo "check:$(cmd_check || true)"
  echo "local:$(http_code "http://127.0.0.1:${HOST_PORT}/api/health")"
  echo "easy:$(https_code "$EASY_HOST" "/api/health")"
  echo "app_login:$(https_code "$DOMAIN" "/login")"
  tail -n 20 "$LOG" 2>/dev/null || true
}

case "${1:-run}" in
  check) cmd_check ;;
  fix) cmd_fix ;;
  fix-backend) cmd_fix_backend ;;
  run) cmd_run ;;
  install) cmd_install ;;
  status) cmd_status ;;
  *)
    echo "Uso: $0 check|fix|fix-backend|run|install|status"
    exit 2
    ;;
esac
