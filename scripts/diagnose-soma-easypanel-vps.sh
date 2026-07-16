#!/bin/bash
# Colar no SSH root do VPS (Hostinger / 72.60.51.127) — só leitura + curl local.
# Não mexe no Traefik (sem force).
set -euo pipefail

echo "=== serviços soma ==="
docker service ls | grep -iE 'soma|gestao' || docker service ls | head -40

SVC="$(docker service ls --format '{{.Name}}' | grep -iE 'soma.*gestao|gestao-interno|soma-promotora' | head -1 || true)"
if [[ -z "${SVC}" ]]; then
  echo "ERRO: serviço soma não encontrado. Liste: docker service ls"
  exit 1
fi
echo "SVC=$SVC"

echo "=== service ps ==="
docker service ps "$SVC" --no-trunc | head -25

echo "=== inspect (Healthcheck / Resources / Env PORT / Endpoint) ==="
docker service inspect "$SVC" --format '
Healthcheck={{json .Spec.TaskTemplate.ContainerSpec.Healthcheck}}
Memory={{json .Spec.TaskTemplate.Resources}}
EnvPORT={{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}
Endpoint={{json .Endpoint.Ports}}
Update={{json .Spec.UpdateConfig}}
'

echo "=== labels / traefik hints ==="
docker service inspect "$SVC" --format '{{json .Spec.Labels}}' | tr ',' '\n' | grep -iE 'traefik|port|easypanel' || true

echo "=== containers ==="
CID="$(docker ps -q -f "name=${SVC}" | head -1 || true)"
if [[ -n "${CID}" ]]; then
  echo "CID=$CID"
  docker inspect "$CID" --format 'Status={{.State.Status}} OOM={{.State.OOMKilled}} Exit={{.State.ExitCode}} Error={{.State.Error}}'
  echo "--- curl DENTRO do container ---"
  docker exec "$CID" sh -c 'echo PORT=$PORT; wget -qO- --timeout=3 http://127.0.0.1:${PORT:-3000}/api/health || wget -qO- --timeout=3 http://127.0.0.1:3000/api/health || wget -qO- --timeout=3 http://127.0.0.1:80/api/health || echo FAIL'
else
  echo "Nenhum container Up — serviço em restart loop."
fi

echo "=== Traefik main.yaml (soma/somaconecta) ==="
grep -iE 'soma|somaconecta|gestao-interno' /etc/easypanel/traefik/config/main.yaml 2>/dev/null | head -50 || echo "sem match ou sem arquivo"

echo "=== probes host ==="
curl -sS -o /dev/null -w "easy_host:%{http_code}\n" --max-time 10 -k https://soma-promotora-app.achpyp.easypanel.host/api/health || echo "easy_host:000"
curl -sS -o /dev/null -w "app_domain:%{http_code}\n" --max-time 10 -k https://app.somaconecta.com.br/api/health || echo "app_domain:000"

echo "=== fim ==="
