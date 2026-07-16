# LOG — Deploy Soma Easypanel (Dockerfile)

## Contexto

Publicar `walkup-tec/soma-master` no Easypanel (`soma-promotora/gestao-interno`), domínio `app.somaconecta.com.br`, porta `3000`.

## Entregue

- `Dockerfile` multi-stage (bun install + `node vite build` + runner `node:22`)
- `docker-entrypoint.sh` (gera `.env.local` incl. EVOLUTION/OPENAI/CHAT_*)
- `vite.config.ts` com `DEPLOY_TARGET=node` + Nitro `node-server`
- dep `nitro`
- Domínio env local Easypanel: `https://app.somaconecta.com.br`

## Easypanel checklist

1. Fonte GitHub `walkup-tec/soma-master` branch `main`
2. Construção: Dockerfile
3. Domínio custom → `http://…:3000/` (estrela como primário)
4. Env colado de `.env.easypanel` com APP_URL = domínio real
5. Implantar

## Keywords

dockerfile, easypanel, nitro, node-server, soma-master, app.somaconecta.com.br
