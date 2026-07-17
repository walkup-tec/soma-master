#!/bin/bash
# Soma — restaura Traefik após Redeploy Easypanel (404 domínio + 502 easypanel.host).
# 1) publish :30300→3000  2) Host sem barra  3) backends 172.17.0.1:30300
# SEM force easypanel-traefik.
set -euo pipefail

SVC="soma-promotora_gestao-interno"
HOST_PORT="${SOMA_HOST_PORT:-30300}"
MAIN="${TRAEFIK_MAIN_YAML:-/etc/easypanel/traefik/config/main.yaml}"
STAMP="$(date +%Y%m%d-%H%M%S)"
NEW_URL="http://172.17.0.1:${HOST_PORT}/"

echo "=== 1) publish ${HOST_PORT}->3000 ==="
if ! ss -tlnp 2>/dev/null | grep -q ":${HOST_PORT} "; then
  docker service update \
    --publish-add "published=${HOST_PORT},target=3000,protocol=tcp,mode=ingress" \
    "$SVC" || true
  sleep 10
else
  echo "porta ${HOST_PORT} já no host"
fi

echo "=== 2) probe local app ==="
code="000"
for i in 1 2 3 4 5 6 7 8; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${HOST_PORT}/api/health" || echo 000)"
  echo "try $i → $code"
  [[ "$code" == "200" ]] && break
  sleep 3
done
if [[ "$code" != "200" ]]; then
  echo "ERRO: app não responde em :${HOST_PORT} — veja logs do serviço"
  docker service ps "$SVC" | head -6
  exit 1
fi

echo "=== 3) patch main.yaml ==="
cp -a "$MAIN" "${MAIN}.bak-soma-all-${STAMP}"
python3 - "$MAIN" "$NEW_URL" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
new_url = sys.argv[2]
t = path.read_text(encoding="utf-8")
orig = t

t = t.replace("Host(`app.somaconecta.com.br/`)", "Host(`app.somaconecta.com.br`)")
t = t.replace('"main": "app.somaconecta.com.br/"', '"main": "app.somaconecta.com.br"')
for old in (
    "http://soma-promotora_gestao-interno:3000/",
    "http://soma-promotora_gestao-interno:80/",
):
    t = t.replace(old, new_url)

for svc in ("soma-promotora_gestao-interno-0", "soma-promotora_gestao-interno-1"):
    pattern = rf'("{svc}"\s*:\s*\{{[^\}}]*?"url"\s*:\s*")[^"]*(")'
    t, n = re.subn(pattern, rf"\1{new_url}\2", t, count=1, flags=re.S)
    print(f"{svc}: {n}")

if t != orig:
    path.write_text(t, encoding="utf-8")
    print("main.yaml atualizado →", new_url)
else:
    print("main.yaml sem mudança (já ok?)")

for line in path.read_text(encoding="utf-8").splitlines():
    if "soma-promotora_gestao-interno" in line and ("url" in line or "Host(`app.somaconecta" in line):
        print(line.strip()[:140])
PY

echo "=== 4) wait + probes ==="
sleep 10
curl -sS -o /dev/null -w "local:%{http_code}\n" --max-time 5 "http://127.0.0.1:${HOST_PORT}/api/health" || true
curl -sS -o /dev/null -w "easy:%{http_code}\n" --max-time 15 -k \
  "https://soma-promotora-app.achpyp.easypanel.host/api/health" || true
curl -sS -o /dev/null -w "app_login:%{http_code}\n" --max-time 15 -k \
  "https://app.somaconecta.com.br/login" || true
curl -sS -o /dev/null -w "app_health:%{http_code}\n" --max-time 15 -k \
  "https://app.somaconecta.com.br/api/health" || true

echo "fim — esperado easy:200 app_login:200"
echo "Nota: Redeploy Easypanel pode reescrever main.yaml; rode de novo se voltar 404/502."
