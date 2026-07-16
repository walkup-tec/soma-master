#!/bin/bash
# Soma: publish :30300→3000 + Traefik backends http://172.17.0.1:30300/
# (overlay soma-promotora_gestao-interno:3000 falha — padrão WABA)
# SEM force Traefik.
set -euo pipefail

SVC="soma-promotora_gestao-interno"
HOST_PORT="${SOMA_HOST_PORT:-30300}"
TARGET_PORT=3000
MAIN="${TRAEFIK_MAIN_YAML:-/etc/easypanel/traefik/config/main.yaml}"
STAMP="$(date +%Y%m%d-%H%M%S)"
NEW_URL="http://172.17.0.1:${HOST_PORT}/"

echo "=== 1) publish host ${HOST_PORT}->${TARGET_PORT} ==="
if ! ss -tlnp 2>/dev/null | grep -q ":${HOST_PORT} "; then
  docker service update \
    --publish-add "published=${HOST_PORT},target=${TARGET_PORT},protocol=tcp,mode=ingress" \
    "$SVC" || true
  sleep 8
else
  echo "porta ${HOST_PORT} já publicada"
fi

echo "=== 2) probe local ==="
code="000"
for i in 1 2 3 4 5 6; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${HOST_PORT}/api/health" || echo 000)"
  echo "try $i → $code"
  [[ "$code" == "200" ]] && break
  sleep 3
done
if [[ "$code" != "200" ]]; then
  echo "ERRO: local :${HOST_PORT} não está 200 — abortando patch Traefik"
  exit 1
fi

echo "=== 3) patch backends → ${NEW_URL} ==="
cp -a "$MAIN" "${MAIN}.bak-soma-hostgw-${STAMP}"

python3 - "$MAIN" "$NEW_URL" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
new_url = sys.argv[2]
text = path.read_text(encoding="utf-8")
orig = text

# Overlay Swarm → host gateway
for old in (
    "http://soma-promotora_gestao-interno:3000/",
    "http://soma-promotora_gestao-interno:80/",
):
    text = text.replace(old, new_url)

# Já hostgw com outra porta → alinhar
import re
text = re.sub(
    r"http://172\.17\.0\.1:\d+/",
    new_url,
    text,
)
# Só mexer nas linhas dos services soma (evitar trocar outros apps)
# Reverter se trocamos backends não-soma: restaurar a partir de backup parcial
# Estratégia mais segura: só substituir dentro dos blocos soma

text = orig
for old in (
    "http://soma-promotora_gestao-interno:3000/",
    "http://soma-promotora_gestao-interno:80/",
):
    text = text.replace(old, new_url)

# Se já era 172.17.0.1 com porta errada só nas chaves soma:
for svc in ("soma-promotora_gestao-interno-0", "soma-promotora_gestao-interno-1"):
    # encontra bloco "svc": { ... "url": "..." }
    pattern = rf'("{svc}"\s*:\s*\{{[^\}}]*?"url"\s*:\s*")[^"]*(")'
    text, n = re.subn(pattern, rf"\1{new_url}\2", text, count=1, flags=re.S)
    print(f"{svc}: {n}")

if text == orig:
    print("AVISO: nenhuma URL alterada — confira grep manual")
else:
    path.write_text(text, encoding="utf-8")
    print("main.yaml atualizado")

for line in path.read_text(encoding="utf-8").splitlines():
    if "soma-promotora_gestao-interno" in line and "url" in line:
        print(line.strip())
PY

echo "=== 4) wait + probes ==="
sleep 10
curl -sS -o /dev/null -w "local:%{http_code}\n" --max-time 5 "http://127.0.0.1:${HOST_PORT}/api/health" || echo "local:000"
curl -sS -o /dev/null -w "easy:%{http_code}\n" --max-time 15 -k \
  "https://soma-promotora-app.achpyp.easypanel.host/api/health" || echo "easy:000"
curl -sS -o /dev/null -w "app:%{http_code}\n" --max-time 15 -k \
  "https://app.somaconecta.com.br/api/health" || echo "app:000"
curl -sS -o /dev/null -w "easy_login:%{http_code}\n" --max-time 15 -k \
  "https://soma-promotora-app.achpyp.easypanel.host/login" || echo "easy_login:000"

echo "fim"
