# LOG — Deploy de tudo pendente para produção

**Data:** 2026-07-17 14:00

## Contexto

Solicitação para deixar pronto para deploy tudo que ainda não havia chegado à produção.

## Estado encontrado

- `main` local e `origin/main` estavam sincronizados em `6987dda`.
- Não havia diferença real de conteúdo pendente; os arquivos listados pelo Git eram somente conversão local LF/CRLF.
- Produção respondia HTTP 200, mas os assets publicados não coincidiam com o build local mais recente.
- GitHub CLI sem autenticação local, portanto não foi possível consultar o workflow pelo `gh`.

## Ações executadas

1. Confirmado `git diff --ignore-space-at-eol`: `NO_CONTENT_DIFF`.
2. Confirmado `HEAD == origin/main`: `6987dda5f76c1362ab1d0eaf8593596740b77d51`.
3. Validada produção em `https://app.somaconecta.com.br`: HTTP 200.
4. Registrado este snapshot e disparado novo commit/push de deploy para garantir que o Easypanel processe todo o estado atual.

## Validação

- Build imediatamente anterior: `npm run build` concluído com sucesso.
- Produção acessível antes do novo gatilho: HTTP 200.
- Commit de deploy enviado: `540fedf` (`[6987dda] deploy: publica todo estado pendente em producao`).
- Monitoramento por 20 tentativas durante aproximadamente 5 minutos: produção permaneceu HTTP 200, mas continuou servindo `/assets/index-CBqzy7be.js`; a troca de assets não foi confirmada.
- Causa do bloqueio de confirmação: processamento automático do Easypanel/Maker não iniciou ou ainda não concluiu; não há diferença de código local/remoto.

## Segurança

- Nenhum segredo ou arquivo `.env` incluído.
- Alterações aparentes por CRLF não foram commitadas.

## Pendências para retomada

- Confirmar no Maker/Easypanel o deploy com título `[6987dda] deploy: publica todo estado pendente em producao`.
- Se não estiver em execução, acionar Redeploy no Maker e validar a troca de assets.

## Palavras-chave

deploy pendente, Easypanel, Maker, trigger deploy, LF CRLF, origin main
