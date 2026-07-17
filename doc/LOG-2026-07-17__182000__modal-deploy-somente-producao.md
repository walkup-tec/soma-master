# LOG — Modal de atualização somente em deploy de produção

**Data:** 2026-07-17 18:20

## Contexto

O modal “Atualizando o sistema” deve existir apenas como proteção de acesso durante deploy/redeploy do serviço em produção. Desenvolvimento local, build, Git e oscilações isoladas não devem exibi-lo.

## Solução

- Ativação restrita ao host exato `app.somaconecta.com.br`.
- `localhost`, `127.0.0.1`, IPs locais, previews e outros domínios não registram service worker nem expõem a API do modal.
- `showOverlay` e `startRecovery` têm guarda interna de produção, impedindo ativação acidental fora do domínio oficial.
- Duas falhas consecutivas do health check são exigidas antes de iniciar a recuperação visual.
- A segunda confirmação ocorre após 2 segundos; uma falha transitória isolada não abre o modal.
- O service worker continua preservando a última shell válida durante o reinício do backend, mantendo o usuário dentro do sistema.
- Após três health checks estáveis ou mudança do `serverBootId`, a página recarrega automaticamente.

## Limite técnico

Enquanto o backend está indisponível, o navegador não recebe do Easypanel um evento explícito de “deploy”. Assim, o sinal operacional usado é: host oficial de produção + indisponibilidade consecutiva + posterior boot estável. Isso cobre deploy/redeploy e evita falsos positivos por uma única oscilação.

## Arquivo alterado

- `src/lib/ui/deploy-resilience.ts`

## Validação

- Prettier: OK
- ESLint: OK
- `npm run build` (client + SSR): OK

## Segurança

Sem alteração de autenticação, dados ou segredos.

## Palavras-chave

modal somente produção, deploy, redeploy, health check consecutivo, app.somaconecta.com.br, service worker
