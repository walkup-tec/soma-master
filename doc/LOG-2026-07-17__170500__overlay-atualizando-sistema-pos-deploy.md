# Overlay "Atualizando o sistema" pós-deploy (modelo WABA)

## Contexto

Após deploy do serviço `soma-promotora/gestao-interno`, o site às vezes exibia o JSON
do Traefik (`Cannot GET /api/errors/bad-gateway`). Requisito: nunca mostrar essa tela;
permanecer na tela do sistema, exibir modal "Atualizando o sistema" (mesmo modelo do
projeto WABA) e, quando o serviço estiver pronto, fechar o modal e recarregar.

## Modelo de origem (WABA)

- `index.html` do WABA: overlay `waba-deploy-overlay` com spinner, barra de progresso,
  título "ATUALIZANDO O SISTEMA", fases deploying/stabilizing/complete, poll de
  `/health` a cada 2s, 3 sondas estáveis para concluir, drift de `serverBootId`.
- `media/sw-deploy-resilience.js`: service worker que serve a última shell HTML em
  502/503/504 durante navegações.

## Solução implementada no Soma

1. `src/routes/api/health.ts` agora devolve `serverBootId` (UUID por boot do processo)
   para o front detectar quando o novo deploy subiu.
2. `src/lib/ui/deploy-resilience.ts` (novo): script bootstrap sem React, injetado no
   `<head>` pelo `__root.tsx` (mesmo padrão do tema/processing overlay):
   - vigia `/api/health` a cada 8s em segundo plano (e ao voltar o foco da aba);
   - queda (502–504, resposta não-ok ou rede) ⇒ mostra o overlay e sonda a cada 2s;
   - 3 sondas estáveis seguidas ou `serverBootId` diferente do baseline ⇒ fase
     "complete" e `location.reload()`;
   - após 120s exibe mensagem de espera longa, sem sair da tela;
   - drift de bootId com serviço saudável (deploy rápido sem downtime percebido)
     ⇒ overlay breve + reload;
   - ativo somente em host `somaconecta.com.br` (não em localhost/IP privado).
3. `public/sw-deploy-resilience.js` (novo): em navegações GET text/html, guarda a
   última shell HTML válida em cache; se o servidor responder 502–504 **ou** erro
   não-HTML (o JSON 404 do Traefik `bad-gateway`), devolve a shell em cache — assim o
   overlay assume dentro do app em vez da tela JSON. Rotas `/api/*` nunca passam pelo
   cache.
4. Registro do SW no `load` (somente produção).

## Arquivos criados/alterados

- `src/lib/ui/deploy-resilience.ts` (novo)
- `public/sw-deploy-resilience.js` (novo)
- `src/routes/api/health.ts`
- `src/routes/__root.tsx`
- `doc/memoria.md`

## Como validar

1. Local: `curl /api/health` → `{ok:true, serverBootId:...}`; `/sw-deploy-resilience.js`
   → 200; HTML contém `soma-deploy` (validado).
2. Produção (após deploy): fazer Redeploy no Easypanel com o app aberto — deve surgir
   o modal "ATUALIZANDO O SISTEMA" e, ao final, a tela recarrega sozinha.
3. Hard refresh durante o redeploy: o SW devolve a shell e o overlay assume.

## Observações

- Primeira visita durante um deploy (sem SW registrado ainda) não tem shell em cache;
  nesse único caso o Traefik ainda pode responder antes do app. A partir da primeira
  navegação bem-sucedida o SW cobre os próximos deploys.
- Sem segredos; o SW ignora `/api/*` e não intercepta POST.

## Palavras-chave

`deploy overlay`, `atualizando o sistema`, `sw-deploy-resilience`, `serverBootId`,
`bad-gateway`, `soma-deploy-overlay`
