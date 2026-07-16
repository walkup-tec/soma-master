#!/bin/bash
# Soma 502 com routers :3000 corretos = Traefik não alcança overlay DNS.
# Padrão WABA: publish host + backend http://172.17.0.1:PORT/
# Doc: ucp-traefik-static-dynamic — SEM force Traefik.
set -euo pipefail

SVC="soma-promotora_gestao-interno"
HOST_PORT="${SOMA_HOST_PORT:-30300}"
TARGET_PORT=3000
MAIN="${TRAEFIK_MAIN_YAML:-/etc/easypanel/traefik/config/main.yaml}"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "=== 1) publish host ${HOST_PORT}->${TARGET_PORT} (se ainda não) ==="
if ss -tlnp | grep -q ":${HOST_PORT} "; then
  echo "porta ${HOST_PORT} já em uso no host — ok se for deste serviço"
else
  docker service update --publish-add "published=${HOST_PORT},target=${TARGET_PORT},protocol=tcp,mode=ingress" "$SVC" || \
  docker service update --publish-add "${HOST_PORT}:${TARGET_PORT}" "$SVC" || true
  sleep 8
fi

echo "=== 2) probe local host gateway ==="
for i in 1 2 3 4 5 6; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${HOST_PORT}/api/health" || echo 000)"
  echo "try $i local:${HOST_PORT}/api/health → $code"
  if [[ "$code" == "200" ]]; then break; fi
  sleep 3
done

if [[ "${code:-000}" != "200" ]]; then
  echo "=== fallback: curl via IP do container ==="
  CID="$(docker ps -q -f "name=${SVC}" | head -1 || true)"
  if [[ -n "$CID" ]]; then
    CIP="$(docker inspect "$CID" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' | awk '{print $1}')"
    echo "CID=$CID CIP=$CIP"
    curl -sS -o /dev/null -w "container_ip:%{http_code}\n" --max-time 3 "http://${CIP}:3000/api/health" || true
    echo "--- logs (tail) ---"
    docker logs --tail 30 "$CID" 2>&1 || true
  fi
  echo "AVISO: host :${HOST_PORT} ainda não 200 — confira logs do app (SESSION_SECRET, crash)."
fi

echo "=== 3) patch Traefik backends → 172.17.0.1:${HOST_PORT} ==="
cp -a "$MAIN" "${MAIN}.bak-soma-hostgw-${STAMP}"
python3 - <<PY
from pathlib import Path
import re
path = Path("$MAIN")
text = path.read_text(encoding="utf-8")
new = "http://172.17.0.1:${HOST_PORT}/"
# qualquer backend do serviço soma gestao-interno
text2, n = re.subn(
    r'http://soma-promotora_gestao-interno:\d+/',
    new,
    text,
)
# também se já estiver em outro hostgw
text2, n2 = re.subn(
    r'http://172\.17\.0\.1:\d+/(\s*")',
    # only touch lines near soma — safer: replace known soma service urls only via first pattern
    r'http://172.17.0.1:\d+/\1',
    text2,
)
# Re-apply precisely for soma service blocks
import json
# YAML-ish JSON keys in easypanel file — stick to regex on service names
for svc in ("soma-promotora_gestao-interno-0", "soma-promotora_gestao-interno-1"):
    pattern = rf'("{svc}"\s*:\s*\{{[^}}]*?"url"\s*:\s*")[^"]+(")'
    text2, nn = re.subn(pattern, rf'\g<1>{new}\g<2>', text2, flags=re.S)
    print(f"{svc}: {nn} url(s)")

if text2 != text:
    path.write_text(text2, encoding="utf-8")
    print(f"backends → {new}")
else:
    # force simple replace of overlay for this service name
    text3 = text.replace("http://soma-promotora_gestao-interno:3000/", new)
    text3 = text3.replace("http://soma-promotora_gestao-interno:80/", new)
    if text3 != text:
        path.write_text(text3, encoding="utf-8")
        print(f"backends (simple) → {new}")
    else:
        print("nenhuma mudança de URL (já hostgw?)")
        path.write_text(text, encoding="utf-8")

print("--- urls soma ---")
for line in path.read_text(encoding="utf-8").splitlines():
    if "soma-promotora_gestao-interno" in line and "url" in line:
        print(line.strip())
PY

echo "=== 4) wait watch + probes ==="
sleep 10
curl -sS -o /dev/null -w "local:%{http_code}\n" --max-time 5 "http://127.0.0.1:${HOST_PORT}/api/health" || echo "local:000"
curl -sS -o /dev/null -w "easy:%{http_code}\n" --max-time 15 -k \
  https://soma-promotora-app.achpyp.easypanel.host/api/health || echo "easy:000"
curl -sS -o /dev/null -w "app:%{http_code}\n" --max-time 15 -k \
  https://app.somaconecta.com.br/api/health || echo "app:000"
curl -sS -o /dev/null -w "easy_login:%{http_code}\n" --max-time 15 -k \
  https://soma-promotora-app.achpyp.easypanel.host/login || echo "easy_login:000"

echo "=== 5) overlay vs hostgw (diagnóstico) ==="
TRAEFIK_CID="$(docker ps -q -f name=easypanel-traefik | head -1 || true)"
if [[ -n "$TRAEFIK_CID" ]]; then
  docker exec "$TRAEFIK_CID" wget -qO- --timeout=3 "http://soma-promotora_gestao-interno:3000/api/health" >/dev/null 2>&1 \
    && echo "overlay DNS: OK" || echo "overlay DNS: FALHOU (esperado — por isso hostgw)"
  docker exec "$TRAEFIK_CID" wget -qO- --timeout=3 "http://172.17.0.1:${HOST_PORT}/api/health" >/dev/null 2>&1 \
    && echo "hostgw 172.17.0.1:${HOST_PORT}: OK" || echo "hostgw: FALHOU"
fi

echo "fim. Se easy:200, está resolvido. Domínios no painel devem ficar em 3000 para não recriar :80."
