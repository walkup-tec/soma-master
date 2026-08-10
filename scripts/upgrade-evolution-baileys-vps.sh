#!/usr/bin/env bash
# =============================================================================
# Atualiza Baileys no container Evolution (walkup-evo) para corrigir outbound
# PENDING→ERROR em sessões NOVAS (tc-token / Nack 463).
#
# Evidência Soma:
#   - App WhatsApp no chip envia/recebe normal
#   - Instância walkup (sessão antiga, mesmo EVO) → SERVER_ACK
#   - soma-crm (sessão nova) → PENDING → ERROR
#
# Onde: SSH root @ srv1261237
#
# Uso:
#   bash scripts/upgrade-evolution-baileys-vps.sh           # dry-run
#   APPLY=1 bash scripts/upgrade-evolution-baileys-vps.sh  # aplica + restart
#
# Impacto:
#   - Reinicia o container/serviço Evolution (todas as instâncias do EVO
#     reconectam; pode haver alguns minutos de instabilidade no WABA/aquecedor
#     que usam o mesmo EVO).
#   - Depois: reconectar soma-crm (1 QR) e testar sendText → SERVER_ACK.
# =============================================================================
set -euo pipefail

APPLY="${APPLY:-0}"
BAILEYS_VERSION="${BAILEYS_VERSION:-7.0.0-rc13}"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERRO: $*"; exit 1; }

[[ "$(id -u)" -eq 0 ]] || die "rode como root"

detect() {
  docker ps --format '{{.Names}}' | grep -Ei "$1" | head -n1 || true
}

# Preferir container da API (não manager/frontend)
EVO_CONTAINER="${EVO_CONTAINER:-}"
if [[ -z "$EVO_CONTAINER" ]]; then
  for pat in 'walkup-evo.*api' 'evolution-api' 'evolution_api' 'walkup-evo'; do
    EVO_CONTAINER="$(detect "$pat")"
    [[ -n "$EVO_CONTAINER" ]] && break
  done
fi
[[ -n "$EVO_CONTAINER" ]] || die "container Evolution API não encontrado (docker ps)"

log "Container: $EVO_CONTAINER"
log "Image: $(docker inspect -f '{{.Config.Image}}' "$EVO_CONTAINER")"

log "=== Baileys / versão atual ==="
docker exec "$EVO_CONTAINER" sh -c '
  set +e
  echo "cwd=$(pwd)"
  ls -la package.json 2>/dev/null | head -1
  if [ -f node_modules/@whiskeysockets/baileys/package.json ]; then
    echo -n "@whiskeysockets/baileys=";
    grep -m1 "\"version\"" node_modules/@whiskeysockets/baileys/package.json
  fi
  if [ -f node_modules/baileys/package.json ]; then
    echo -n "baileys=";
    grep -m1 "\"version\"" node_modules/baileys/package.json
  fi
  # tc-token presente?
  if [ -f node_modules/@whiskeysockets/baileys/lib/Utils/tc-token-utils.js ] \
     || [ -f node_modules/@whiskeysockets/baileys/lib/Utils/tc-token-utils.mjs ] \
     || [ -f node_modules/baileys/lib/Utils/tc-token-utils.js ]; then
    echo "tc-token-utils=PRESENT"
  else
    echo "tc-token-utils=MISSING (provável causa do ERROR em sessão nova)"
  fi
  node -e "try{console.log(\"node\",process.version)}catch(e){}"
'

if [[ "$APPLY" != "1" ]]; then
  log "DRY-RUN. Para aplicar:"
  log "  APPLY=1 bash $0"
  exit 0
fi

log "=== Instalando Baileys ${BAILEYS_VERSION} ==="
docker exec "$EVO_CONTAINER" sh -c "
  set -e
  cd /evolution || cd /app || cd /
  if [ -d node_modules/@whiskeysockets/baileys ]; then
    npm install @whiskeysockets/baileys@${BAILEYS_VERSION} --save --legacy-peer-deps --no-fund --no-audit
  elif [ -d node_modules/baileys ]; then
    npm install baileys@${BAILEYS_VERSION} --save --legacy-peer-deps --no-fund --no-audit
  else
    # tenta ambos
    npm install @whiskeysockets/baileys@${BAILEYS_VERSION} --save --legacy-peer-deps --no-fund --no-audit || \
    npm install baileys@${BAILEYS_VERSION} --save --legacy-peer-deps --no-fund --no-audit
  fi
"

log "=== Conferência pós-install ==="
docker exec "$EVO_CONTAINER" sh -c '
  if [ -f node_modules/@whiskeysockets/baileys/package.json ]; then
    echo -n "@whiskeysockets/baileys=";
    grep -m1 "\"version\"" node_modules/@whiskeysockets/baileys/package.json
  fi
  if [ -f node_modules/baileys/package.json ]; then
    echo -n "baileys=";
    grep -m1 "\"version\"" node_modules/baileys/package.json
  fi
  ls node_modules/@whiskeysockets/baileys/lib/Utils/tc-token-utils.* 2>/dev/null \
    || ls node_modules/baileys/lib/Utils/tc-token-utils.* 2>/dev/null \
    || echo "AVISO: tc-token-utils ainda não encontrado no path esperado"
'

log "=== Restart do container ==="
docker restart "$EVO_CONTAINER"
log "Aguardando 20s..."
sleep 20
docker ps --filter "name=${EVO_CONTAINER}" --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'

log "Pronto."
log "Próximo:"
log "  1) No CRM: Gerar QR da soma-crm (uma vez) e escanear"
log "  2) Testar envio — deve ir para SERVER_ACK (não ERROR)"
log "  3) Se o EasyPanel redeployar o EVO, o npm install pode ser perdido (imagem imutável)."
log "     Nesse caso fixe a versão na imagem/compose do EasyPanel."
