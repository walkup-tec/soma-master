# LOG — Fix bun.lock para deploy Easypanel (xyflow)

**Data:** 2026-07-19 14:40:00  
**Repo:** Soma

## Problema

Deploy Easypanel falhou: `bun install --frozen-lockfile` — `lockfile had changes`.  
`@xyflow/react` entrou no `package.json` via npm, mas o `bun.lock` não foi atualizado.

## Correção

`bun install` local → `bun.lock` com `@xyflow/react@12.11.2` e deps.

## Validar

Redeploy Easypanel do commit seguinte; stage `deps` deve passar o frozen lockfile.
