# LOG — Entrypoint CRLF (sem Listening após echo)

**Data:** 2026-07-16 ~20:23

## Evidência

Log: `soma-entrypoint: Nitro 0.0.0.0:80` e **não** aparece `Listening on`.  
Memória ~13 MB. Host Easypanel ainda **502**; domínio custom **404**.

## Causa

`docker-entrypoint.sh` commitado com **CRLF** (Windows `core.autocrlf`). No Linux o `exec` pode resolver `index.mjs\r` → Node aborta logo após o `echo`, sem bind.

## Correção

- `.gitattributes` → `eol=lf` nos scripts Docker
- `Dockerfile` → `sed -i 's/\r$//'` no entrypoint
- `docker-start.mjs` (sem `node --import`) + validação `SESSION_SECRET`
- Domínio HTTP no painel = valor de `PORT` (ex. 80)

## Validar

Logs na ordem: `soma-entrypoint` → `soma-start: loading Nitro` → `Listening on: http://localhost/` (porta 80 omite `:80`) e **permanece** sem `Server closed`.  
`/login` no host `*.easypanel.host` → 200.
