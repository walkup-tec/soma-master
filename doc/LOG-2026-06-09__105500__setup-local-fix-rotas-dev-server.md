# LOG 2026-06-09 — Setup local + fix rotas

## Solicitação
- Projeto Sinal Verde CRM em D:\CRM-SinalVerde
- Git: walkup-tec/sinal-verde-pro
- Usuário pediu execução autônoma (git, dev server, etc.)

## Alterações
- Rotas: `src/routes/_app*` → `src/routes/app*`
- `src/routeTree.gen.ts` regenerado pelo Vite
- Commit `7470816` push `origin/main`

## Comandos
- `bun install`, `bun run build`, `bun run dev`
- `git push origin main`

## Validação
- `GET http://localhost:8081/login` → 200, HTML com "Sinal Verde"
- `wrangler whoami` → não autenticado

## Próximo
- Cloudflare: `wrangler login` + deploy + DNS acesso-sinalverde.com
