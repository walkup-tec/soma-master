#!/bin/bash
# Diagnóstico DNS/DB do Soma no VPS — db.*.supabase.co é IPv6-only (sem A).
# Container Docker sem IPv6 → getaddrinfo ENOTFOUND no login.
set -euo pipefail

HOST="db.zyjkxydesmvtvrsouqbu.supabase.co"
SVC="soma-promotora_gestao-interno"

echo "=== host VPS DNS ==="
getent ahosts "$HOST" || true
dig +short A "$HOST" @1.1.1.1 || true
dig +short AAAA "$HOST" @1.1.1.1 || true

echo "=== host VPS TCP 6543/5432 ==="
for p in 6543 5432; do
  if timeout 5 bash -c "echo >/dev/tcp/${HOST}/${p}" 2>/dev/null; then
    echo "host tcp $p: OK"
  else
    echo "host tcp $p: FAIL"
  fi
done

CID="$(docker ps -q -f "name=${SVC}" | head -1 || true)"
if [[ -z "$CID" ]]; then
  echo "container não está Up"
  exit 1
fi
echo "CID=$CID"

echo "=== DNS dentro do container ==="
docker exec "$CID" node -e "
const dns=require('dns');
dns.lookup('$HOST',{all:true},(e,a)=>{console.log('lookup',e&&e.code,a);});
dns.resolve4('$HOST',(e,a)=>{console.log('A',e&&e.code,a);});
dns.resolve6('$HOST',(e,a)=>{console.log('AAAA',e&&e.code,a);});
setTimeout(()=>{},2000);
" || true

echo ""
echo "Se container A=ENOTFOUND e AAAA falha/inexistente: habilitar IPv6 no Docker"
echo "OU no Supabase Dashboard → Connect → Transaction pooler (URI com IPv4) e colar em DATABASE_URL."
echo "Pooler na mesma host :6543 funciona na rede com IPv6: "
echo "DATABASE_URL=postgresql://postgres:SENHA@db.zyjkxydesmvtvrsouqbu.supabase.co:6543/postgres"
