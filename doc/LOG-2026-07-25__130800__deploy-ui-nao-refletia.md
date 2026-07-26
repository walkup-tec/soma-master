# LOG — Deploy no ar sem UI nova (dois bots expediente)

**Data:** 2026-07-25

## Contexto
Usuario reportou: subi o deploy, mas nao exibe as mudancas.

## Evidencia
- `origin/main` tip: `8b3dd18` (empty force) apos `a7519bc` (dois bots).
- Asset vivo `index-HtlMGf8n.js`: Last-Modified **2026-07-25 14:42:38 GMT** (~11:42 BRT).
- Bundle vivo tem UI de **500d21a** (Bot e Integracoes, Transferir Bot, Sempre aberto, `activeBotId`).
- Bundle vivo **nao** tem `a7519bc` (`expedienteBotId` / `foraExpedienteBotId` / "Bots por janela" / "Bot fora expediente").

## Causa
EasyPanel **nao rebuildou** apos `a7519bc` (11:57 BRT). Empty commit `8b3dd18` tambem nao alterou ETag ainda.

## Acao
1. Push empty commit `8b3dd18` para tentar gatilhar auto-deploy.
2. Se ETag continuar igual: Redeploy manual no Easypanel `soma-promotora` / `gestao-interno`.
3. Apos novo build: hard refresh (Ctrl+F5); SW `soma-deploy-shell-v6` pode servir shell antigo ate atualizar.

## Como validar
Procurar no JS publico as strings `foraExpedienteBotId` ou `Bots por janela`. Last-Modified do asset deve ser > 14:42 GMT.

## Keywords
deploy, easypanel, stale-build, chatbotRuntime, foraExpedienteBotId, service-worker, app.somaconecta.com.br
