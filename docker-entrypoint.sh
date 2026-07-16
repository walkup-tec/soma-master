#!/bin/sh
set -eu

APP_DIR="/app"

# Easypanel costuma injetar PORT=80 (porta do proxy). O CRM/Nitro deve
# escutar sempre 3000 — Traefik/domínio no painel apontam para HTTP :3000.
# Doc Nitro: https://nitro.build/deploy/runtimes/node (NITRO_PORT / PORT)
RAW_PORT="${PORT:-}"
case "${RAW_PORT}" in
  ""|80|443) PORT=3000 ;;
  *) PORT="${RAW_PORT}" ;;
esac

# Override explícito se precisar (raro)
if [ -n "${SOMA_LISTEN_PORT:-}" ]; then
  PORT="${SOMA_LISTEN_PORT}"
fi

HOST="${HOST:-0.0.0.0}"
case "${HOST}" in
  localhost|127.0.0.1) HOST=0.0.0.0 ;;
esac

# Garante .env.local para loadLocalEnvFile() do CRM
{
  echo "SESSION_SECRET=${SESSION_SECRET:-}"
  echo "DATABASE_URL=${DATABASE_URL:-}"
  echo "SUPABASE_URL=${SUPABASE_URL:-}"
  echo "SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY:-}"
  echo "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-}"
  echo "APP_URL=${APP_URL:-}"
  echo "PUBLIC_APP_URL=${PUBLIC_APP_URL:-${APP_URL:-}}"
  echo "MAIL_MODE=${MAIL_MODE:-}"
  echo "MAIL_FROM=${MAIL_FROM:-}"
  echo "SMTP_HOST=${SMTP_HOST:-}"
  echo "SMTP_PORT=${SMTP_PORT:-}"
  echo "SMTP_SECURE=${SMTP_SECURE:-}"
  echo "SMTP_USER=${SMTP_USER:-}"
  echo "SMTP_PASS=${SMTP_PASS:-}"
  echo "OPENAI_API_KEY=${OPENAI_API_KEY:-}"
  echo "OPENAI_MODEL=${OPENAI_MODEL:-}"
  echo "EVOLUTION_API_URL=${EVOLUTION_API_URL:-}"
  echo "EVOLUTION_API_KEY=${EVOLUTION_API_KEY:-}"
  echo "EVOLUTION_INSTANCE=${EVOLUTION_INSTANCE:-}"
  echo "CHAT_WEBHOOK_SECRET=${CHAT_WEBHOOK_SECRET:-}"
  echo "CHAT_PUBLIC_BASE_URL=${CHAT_PUBLIC_BASE_URL:-${APP_URL:-}}"
  echo "NODE_ENV=${NODE_ENV:-production}"
  echo "PORT=${PORT}"
  echo "HOST=${HOST}"
} > "${APP_DIR}/.env.local"

if [ ! -f "${APP_DIR}/.output/server/index.mjs" ]; then
  echo "ERRO: build Nitro ausente (.output/server/index.mjs)." >&2
  exit 1
fi

cd "${APP_DIR}"
export PORT
export NITRO_PORT="${PORT}"
export HOST
export NITRO_HOST="${HOST}"

echo "soma-entrypoint: listening Nitro on ${HOST}:${PORT} (raw PORT was '${RAW_PORT:-empty}')"

exec node .output/server/index.mjs
