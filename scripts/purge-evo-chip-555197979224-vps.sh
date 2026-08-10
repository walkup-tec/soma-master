#!/usr/bin/env bash
# =============================================================================
# Limpeza DEFINITIVA do chip 555197979224 na Evolution (VPS compartilhado).
#
# Alvo: apenas instâncias cujo ownerJid/number contenha 555197979224
#       + nomes explícitos soma-crm / soma-ofc (sessões Soma desse chip).
# NÃO toca: walkup, drax-ofc, aquecedor, proxy-*, etc. (a menos que o owner
#           seja exatamente esse chip — aí também remove, pois é resquício).
#
# Onde rodar: SSH root no srv1261237 (72.60.51.127)
#
# Uso:
#   # 1) Simulação (não apaga nada)
#   bash scripts/purge-evo-chip-555197979224-vps.sh
#
#   # 2) Aplicar limpeza + recriar soma-crm pronta para parear ESSE número
#   APPLY=1 RECREATE=1 \
#   EVO_API_KEY='sua-chave' \
#   CHAT_WEBHOOK_SECRET='seu-secret' \
#   bash scripts/purge-evo-chip-555197979224-vps.sh
#
# Variáveis opcionais:
#   EVO_API_URL   default https://walkup-evo-walkup-api.achpyp.easypanel.host
#   EVO_CONTAINER nome do container (auto-detecta se vazio)
#   PG_CONTAINER  container postgres da Evolution (auto)
#   REDIS_CONTAINER container redis da Evolution (auto)
#   APPLY=1       executa deletes (sem isso = dry-run)
#   RECREATE=1    recria soma-crm com number=555197979224 + webhook + pairing code
#
# Impacto:
#   - Remove sessão Baileys / mensagens / contatos das instâncias alvo no EVO
#   - Outras instâncias do mesmo EVO permanecem
#   - CRM Soma continua; só a sessão WhatsApp desse chip é zerada no EVO
# Rollback: não há — é purge. Depois é preciso escanear QR/código de novo.
# =============================================================================
set -euo pipefail

PHONE="${PHONE:-555197979224}"
INSTANCE_KEEP="${INSTANCE_KEEP:-soma-crm}"
EVO_API_URL="${EVO_API_URL:-https://walkup-evo-walkup-api.achpyp.easypanel.host}"
EVO_API_URL="${EVO_API_URL%/}"
APPLY="${APPLY:-0}"
RECREATE="${RECREATE:-0}"
WEBHOOK_URL="${WEBHOOK_URL:-https://app.somaconecta.com.br/api/chat/whatsapp-webhook}"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERRO: $*"; exit 1; }

need_root() {
  [[ "$(id -u)" -eq 0 ]] || die "rode como root no VPS"
}

detect_container() {
  local pattern="$1"
  docker ps --format '{{.Names}}' | grep -Ei "$pattern" | head -n1 || true
}

evo_curl() {
  local method="$1" path="$2"
  shift 2
  curl -sS -X "$method" "${EVO_API_URL}${path}" \
    -H "apikey: ${EVO_API_KEY}" \
    -H "Content-Type: application/json" \
    "$@"
}

need_root

if [[ -z "${EVO_API_KEY:-}" ]]; then
  # Tenta ler do container da API
  EVO_CONTAINER="${EVO_CONTAINER:-$(detect_container 'walkup-evo|evolution-api|evolution_api')}"
  [[ -n "$EVO_CONTAINER" ]] || die "informe EVO_API_KEY=... (não achei container Evolution)"
  EVO_API_KEY="$(docker exec "$EVO_CONTAINER" sh -c 'printenv AUTHENTICATION_API_KEY || printenv AUTHENTICATION_API_KEY_GLOBAL || printenv API_KEY || true' | tr -d '\r' | head -n1)"
  [[ -n "$EVO_API_KEY" ]] || die "EVO_API_KEY vazio — exporte manualmente"
  log "EVO_API_KEY lida do container $EVO_CONTAINER"
else
  EVO_CONTAINER="${EVO_CONTAINER:-$(detect_container 'walkup-evo|evolution-api|evolution_api')}"
fi

PG_CONTAINER="${PG_CONTAINER:-$(detect_container 'evo.*postgres|evolution.*postgres|walkup-evo.*postgres')}"
REDIS_CONTAINER="${REDIS_CONTAINER:-$(detect_container 'evo.*redis|evolution.*redis|walkup-evo.*redis')}"

log "EVO_API_URL=$EVO_API_URL"
log "EVO_CONTAINER=${EVO_CONTAINER:-none}"
log "PG_CONTAINER=${PG_CONTAINER:-none}"
log "REDIS_CONTAINER=${REDIS_CONTAINER:-none}"
log "PHONE=$PHONE APPLY=$APPLY RECREATE=$RECREATE"

# --- 1) Descobrir instâncias alvo via API ---
RAW="$(evo_curl GET '/instance/fetchInstances' || true)"
python3 - <<'PY' "$RAW" "$PHONE" "$INSTANCE_KEEP" > /tmp/evo-purge-targets.json
import json, sys
raw = sys.argv[1]
phone = sys.argv[2]
keep = sys.argv[3]
try:
    data = json.loads(raw)
except Exception:
    data = []
if not isinstance(data, list):
    data = [data] if data else []
targets = []
for row in data:
    if not isinstance(row, dict):
        continue
    name = str(row.get("name") or row.get("instanceName") or "")
    owner = str(row.get("ownerJid") or "")
    number = str(row.get("number") or "")
    hit = (
        phone in owner
        or phone in number
        or name in ("soma-crm", "soma-ofc")
        or name.startswith("soma-") and phone in (owner + number)
    )
    # Nunca incluir instâncias sem relação com o chip / soma-crm|ofc
    if name in ("soma-crm", "soma-ofc") or phone in owner or phone in number:
        targets.append({
            "name": name,
            "id": row.get("id"),
            "status": row.get("connectionStatus"),
            "ownerJid": owner,
            "number": number,
        })
print(json.dumps({"phone": phone, "keep": keep, "targets": targets}, indent=2))
PY

log "Alvos encontrados:"
cat /tmp/evo-purge-targets.json

mapfile -t NAMES < <(python3 - <<'PY'
import json
d=json.load(open("/tmp/evo-purge-targets.json"))
for t in d["targets"]:
    if t.get("name"):
        print(t["name"])
PY
)

if [[ ${#NAMES[@]} -eq 0 ]]; then
  log "Nenhuma instância alvo na API (pode restar lixo em disco/DB). Seguirei purge de pastas soma-crm/soma-ofc se existirem."
  NAMES=(soma-crm soma-ofc)
fi

# --- 2) Logout + delete via API ---
for name in "${NAMES[@]}"; do
  log "API logout $name"
  if [[ "$APPLY" == "1" ]]; then
    evo_curl DELETE "/instance/logout/${name}" >/tmp/evo-logout-"$name".json || true
    cat /tmp/evo-logout-"$name".json || true
    echo
    log "API delete $name"
    evo_curl DELETE "/instance/delete/${name}" >/tmp/evo-delete-"$name".json || true
    cat /tmp/evo-delete-"$name".json || true
    echo
  else
    log "DRY-RUN: pularia logout/delete de $name"
  fi
done

# --- 3) Limpar pastas Baileys em /evolution/instances ---
if [[ -n "${EVO_CONTAINER:-}" ]]; then
  log "Pastas de instância no container:"
  docker exec "$EVO_CONTAINER" sh -c 'ls -la /evolution/instances 2>/dev/null || ls -la /evolution/instance 2>/dev/null || echo "sem /evolution/instances"'
  for name in "${NAMES[@]}" soma-crm soma-ofc; do
    for base_path in /evolution/instances /evolution/instance; do
      if docker exec "$EVO_CONTAINER" sh -c "test -d ${base_path}/${name}" 2>/dev/null; then
        log "Pasta encontrada: ${base_path}/${name}"
        if [[ "$APPLY" == "1" ]]; then
          docker exec "$EVO_CONTAINER" sh -c "rm -rf '${base_path}/${name}'"
          log "Removida ${base_path}/${name}"
        else
          log "DRY-RUN: removeria ${base_path}/${name}"
        fi
      fi
    done
  done
fi

# --- 4) Postgres: apagar por nome/id das instâncias alvo (schema Prisma Evolution) ---
if [[ -n "${PG_CONTAINER:-}" ]]; then
  log "Limpando Postgres (somente instâncias alvo)..."
  # Monta lista SQL-safe de nomes
  NAMES_SQL="$(printf "%s\n" "${NAMES[@]}" soma-crm soma-ofc | sort -u | python3 -c 'import sys; print(",".join("\x27"+l.strip().replace("\x27","")+"\x27" for l in sys.stdin if l.strip()))')"
  SQL=$(cat <<SQL
DO \$\$
DECLARE
  ids text[];
BEGIN
  SELECT array_agg(id::text) INTO ids
  FROM "Instance"
  WHERE name IN (${NAMES_SQL})
     OR COALESCE("ownerJid",'') LIKE '%${PHONE}%'
     OR COALESCE(number,'') LIKE '%${PHONE}%';

  IF ids IS NULL OR array_length(ids,1) IS NULL THEN
    RAISE NOTICE 'Nenhuma Instance alvo no Postgres';
    RETURN;
  END IF;

  RAISE NOTICE 'Instance ids: %', ids;

  -- Tabelas comuns Evolution v2 (ignoram se não existirem)
  BEGIN DELETE FROM "MessageUpdate" WHERE "messageId" IN (SELECT id FROM "Message" WHERE "instanceId" = ANY(ids)); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM "Message" WHERE "instanceId" = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM "Contact" WHERE "instanceId" = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM "Chat" WHERE "instanceId" = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM "Session" WHERE "instanceId" = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM "Webhook" WHERE "instanceId" = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM "Setting" WHERE "instanceId" = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM "Proxy" WHERE "instanceId" = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM "IntegrationSession" WHERE "instanceId" = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM "Label" WHERE "instanceId" = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM "IsOnWhatsapp" WHERE "instanceId" = ANY(ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  DELETE FROM "Instance" WHERE id::text = ANY(ids);
END \$\$;
SQL
)
  if [[ "$APPLY" == "1" ]]; then
    docker exec -i "$PG_CONTAINER" psql -U postgres -v ON_ERROR_STOP=0 -c "$SQL" \
      || docker exec -i "$PG_CONTAINER" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=0' <<<"$SQL" \
      || log "AVISO: SQL Postgres falhou parcialmente — confira schema/credencial"
  else
    log "DRY-RUN SQL (resumo): delete Instance + Message/Contact/Chat/Session/Webhook onde name in (${NAMES_SQL}) ou owner=${PHONE}"
  fi
else
  log "AVISO: PG_CONTAINER não detectado — pulei limpeza SQL (API+disco ainda limpam sessão)"
fi

# --- 5) Redis: chaves da instância ---
if [[ -n "${REDIS_CONTAINER:-}" ]]; then
  for name in "${NAMES[@]}" soma-crm soma-ofc; do
    log "Redis SCAN *${name}*"
    if [[ "$APPLY" == "1" ]]; then
      docker exec "$REDIS_CONTAINER" sh -c \
        "redis-cli --scan --pattern '*${name}*' | while read -r k; do [ -n \"\$k\" ] && redis-cli DEL \"\$k\" >/dev/null; done; echo done-${name}" \
        || log "AVISO: redis limpeza parcial para $name"
    else
      docker exec "$REDIS_CONTAINER" sh -c "redis-cli --scan --pattern '*${name}*' | head -20" || true
    fi
  done
fi

# --- 6) Recriar soma-crm limpa para PAREAR o mesmo número ---
if [[ "$RECREATE" == "1" ]]; then
  [[ "$APPLY" == "1" ]] || die "RECREATE=1 exige APPLY=1"
  log "Aguardando 3s após purge..."
  sleep 3
  # Garante que não sobrou
  evo_curl DELETE "/instance/delete/${INSTANCE_KEEP}" >/dev/null || true
  sleep 2

  WH_HEADERS=""
  if [[ -n "${CHAT_WEBHOOK_SECRET:-}" ]]; then
    WH_HEADERS=$(printf '"headers":{"x-soma-webhook-secret":"%s"},' "$CHAT_WEBHOOK_SECRET")
  fi

  CREATE_BODY=$(cat <<JSON
{
  "instanceName": "${INSTANCE_KEEP}",
  "qrcode": true,
  "integration": "WHATSAPP-BAILEYS",
  "number": "${PHONE}",
  "webhook": {
    "enabled": true,
    "url": "${WEBHOOK_URL}",
    "byEvents": false,
    "base64": true,
    ${WH_HEADERS}
    "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"]
  }
}
JSON
)

  log "Criando ${INSTANCE_KEEP} com number=${PHONE}"
  echo "$CREATE_BODY" | evo_curl POST "/instance/create" --data-binary @- | tee /tmp/evo-create-soma-crm.json
  echo
  sleep 2
  log "Solicitando pairing code..."
  evo_curl GET "/instance/connect/${INSTANCE_KEEP}?number=${PHONE}" | tee /tmp/evo-connect-soma-crm.json
  echo
  python3 - <<'PY'
import json
try:
  d=json.load(open("/tmp/evo-connect-soma-crm.json"))
except Exception:
  d={}
code=d.get("pairingCode")
print("")
print("============================================")
if code:
  print("CODIGO DE PAREAMENTO:", code)
  print("WhatsApp > Aparelhos conectados > Conectar com numero")
else:
  print("Sem pairingCode na resposta — use o QR do painel CRM.")
print("Numero obrigatorio:", "555197979224")
print("============================================")
PY
fi

log "Conferência final fetchInstances (filtro chip/soma):"
evo_curl GET "/instance/fetchInstances" > /tmp/evo-fetch-after.json || true
python3 - <<'PY'
import json
phone="555197979224"
try:
  data=json.load(open("/tmp/evo-fetch-after.json"))
except Exception:
  data=[]
if not isinstance(data,list): data=[data]
found=False
for row in data:
  if not isinstance(row,dict): continue
  name=str(row.get("name") or "")
  owner=str(row.get("ownerJid") or "")
  number=str(row.get("number") or "")
  if name in ("soma-crm","soma-ofc") or phone in owner or phone in number:
    found=True
    print(json.dumps({"name":name,"status":row.get("connectionStatus"),"owner":owner,"number":number,"id":row.get("id")}, ensure_ascii=False))
if not found:
  print("(nenhuma instância residual com o chip / soma-crm|ofc)")
PY

if [[ "$APPLY" != "1" ]]; then
  log "DRY-RUN concluído. Para aplicar de verdade:"
  log "  APPLY=1 RECREATE=1 EVO_API_KEY=... CHAT_WEBHOOK_SECRET=... bash $0"
fi

log "Fim."
