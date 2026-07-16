#!/bin/bash
# Ponte IPv4→IPv6 para Supabase (db.* só tem AAAA; Docker do Swarm falha ENOTFOUND).
# Escuta 0.0.0.0:6543 no host → TCP6 db.xxx.supabase.co:6543
# Depois no Easypanel:
#   DATABASE_URL=postgresql://postgres:SENHA@172.17.0.1:6543/postgres
#   DATABASE_SSL_INSECURE=true
# SEM mexer no Traefik.
set -euo pipefail

SUPA_HOST="db.zyjkxydesmvtvrsouqbu.supabase.co"
LISTEN_PORT="${SOMA_PG_BRIDGE_PORT:-6543}"
UNIT="soma-supabase-pg-bridge.service"

echo "=== DNS host ==="
AAAA="$(dig +short AAAA "$SUPA_HOST" @1.1.1.1 | head -1 || true)"
echo "AAAA=$AAAA"
if [[ -z "$AAAA" ]]; then
  echo "ERRO: host sem AAAA — confira o project ref Supabase"
  exit 1
fi

if ! command -v socat >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq socat
fi

echo "=== teste IPv6 do host → Supabase :6543 ==="
if timeout 8 bash -c "echo >/dev/tcp/${SUPA_HOST}/6543" 2>/dev/null; then
  echo "host alcança ${SUPA_HOST}:6543"
else
  echo "AVISO: host pode não ter IPv6 de saída; a bridge pode falhar"
fi

cat > "/etc/systemd/system/${UNIT}" <<EOF
[Unit]
Description=Soma Supabase Postgres IPv4-to-IPv6 bridge (:${LISTEN_PORT})
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/socat TCP4-LISTEN:${LISTEN_PORT},bind=0.0.0.0,fork,reuseaddr TCP6:${SUPA_HOST}:6543
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$UNIT"
systemctl --no-pager --full status "$UNIT" | head -20

sleep 1
ss -tlnp | grep ":${LISTEN_PORT} " || true

echo "=== probe local bridge ==="
# TLS handshake mínimo não; só TCP
timeout 3 bash -c "echo >/dev/tcp/127.0.0.1/${LISTEN_PORT}" && echo "bridge tcp OK" || echo "bridge tcp FAIL"

echo ""
echo "No Easypanel → gestao-interno → Environment, SUBSTITUA:"
echo "DATABASE_URL=postgresql://postgres:SUA_SENHA_SUPABASE@172.17.0.1:${LISTEN_PORT}/postgres"
echo "DATABASE_SSL_INSECURE=true"
echo ""
echo "Redeploy após push com suporte DATABASE_SSL_INSECURE (ou restart se a imagem já tiver)."
