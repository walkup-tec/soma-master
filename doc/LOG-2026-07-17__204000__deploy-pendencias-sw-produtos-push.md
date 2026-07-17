# LOG — Deploy pendências Soma (SW, produtos, push base64)

## Contexto

Usuário pediu subir todas as atualizações pendentes para deploy.

## Commit / push

- Repo: `walkup-tec/soma-master` branch `main`
- Commit: `43139cd` — assunto `[395e9dc] fix: SW fallback deploy, lista produtos e push base64 puro`
- Push: `395e9dc..43139cd` → `origin/main` OK

## Incluído

1. SW v4 + modal fallback (bad-gateway)
2. Lista produtos×banco na Etapa 1
3. Push comunidade: base64 puro / URL / fallback texto

## Não incluído (só CRLF/prettier local)

LOGs antigos, scripts e formatação em users/push sem mudança funcional.

## Validar

1. Easypanel: deploy com título `[395e9dc] …`
2. Após redeploy: heal Soma `:30300` se login/app 502
3. Push com imagem na comunidade
4. F5 durante janela de deploy → modal, não JSON

## Keywords

deploy soma, 43139cd, SW v4, owned media, produtos lista
