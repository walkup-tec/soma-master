#!/bin/bash
# Corrige routers/services Soma no Traefik Easypanel (routing dinâmica — SEM force Traefik).
# Evidência do diagnose:
#   - gestao-interno-0 → http://soma-promotora_gestao-interno:80/  (app escuta 3000) → 502
#   - Host(`app.somaconecta.com.br/`) com barra no hostname → 404
# Doc: https://doc.traefik.io/traefik/getting-started/configuration-overview/
#      https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/
set -euo pipefail

MAIN="${TRAEFIK_MAIN_YAML:-/etc/easypanel/traefik/config/main.yaml}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BAK="${MAIN}.bak-soma-${STAMP}"

if [[ ! -f "$MAIN" ]]; then
  echo "ERRO: não achei $MAIN"
  exit 1
fi

cp -a "$MAIN" "$BAK"
echo "backup: $BAK"

python3 - <<'PY'
from pathlib import Path
import re
import sys

path = Path("/etc/easypanel/traefik/config/main.yaml")
text = path.read_text(encoding="utf-8")
orig = text

# 1) Host com barra inválida no domínio custom
replacements = [
    (r"Host\(`app\.somaconecta\.com\.br/`\)", "Host(`app.somaconecta.com.br`)"),
    (r'"main":\s*"app\.somaconecta\.com\.br/"', '"main": "app.somaconecta.com.br"'),
    # 2) Backend do host *.easypanel.host ainda em :80 — app escuta 3000
    (
        r'("soma-promotora_gestao-interno-0"\s*:\s*\{[^}]*?"url"\s*:\s*")http://soma-promotora_gestao-interno:80/(")',
        r"\g<1>http://soma-promotora_gestao-interno:3000/\g<2>",
    ),
    (
        r'http://soma-promotora_gestao-interno:80/',
        'http://soma-promotora_gestao-interno:3000/',
    ),
]

for pattern, repl in replacements:
    text, n = re.subn(pattern, repl, text, flags=re.S)
    print(f"replace {pattern[:50]}… → {n} ocorrência(s)")

if text == orig:
    print("Nenhuma alteração necessária (já corrigido?)")
else:
    path.write_text(text, encoding="utf-8")
    print("main.yaml atualizado — aguardar file watch Traefik (~8s), SEM force")

# Mostra trechos relevantes
for needle in ("soma-promotora_gestao-interno", "somaconecta"):
    pass

import subprocess
subprocess.run(
    ["grep", "-n", "-E", "soma-promotora_gestao-interno|somaconecta", str(path)],
    check=False,
)
PY

echo "=== wait file provider ==="
sleep 10

echo "=== probes ==="
curl -sS -o /dev/null -w "easy_health:%{http_code}\n" --max-time 15 \
  -k https://soma-promotora-app.achpyp.easypanel.host/api/health || echo "easy_health:000"
curl -sS -o /dev/null -w "easy_login:%{http_code}\n" --max-time 15 \
  -k https://soma-promotora-app.achpyp.easypanel.host/login || echo "easy_login:000"
curl -sS -o /dev/null -w "app_health:%{http_code}\n" --max-time 15 \
  -k https://app.somaconecta.com.br/api/health || echo "app_health:000"
curl -sS -o /dev/null -w "app_login:%{http_code}\n" --max-time 15 \
  -k https://app.somaconecta.com.br/login || echo "app_login:000"

echo "=== containers soma (deve ficar Running estável) ==="
docker service ps soma-promotora_gestao-interno | head -8

echo "OK. No Easypanel: Domínios → porta 3000 nos DOIS hosts; domínio SEM barra no fim."
echo "Env: APP_URL=https://app.somaconecta.com.br (com 'a' — o dump tinha somaconect.com.br errado)."
echo "Remova PORT=80 duplicado do Environment se ainda existir."
