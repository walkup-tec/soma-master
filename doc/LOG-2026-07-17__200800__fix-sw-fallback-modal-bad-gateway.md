# LOG — SW fallback + modal ante JSON bad-gateway pós-deploy

## Contexto

Após redeploy (~40s), o browser mostrou JSON do Traefik/Easypanel:

`{"status":404,"error":"Not Found","response":{"message":["Cannot GET /api/errors/bad-gateway"]}}`

Depois a app voltou. O modal “ATUALIZANDO O SISTEMA” existia, mas **não cobria refresh/navegação sem shell em cache** — o SW só devolve cache; sem cache, passava o JSON.

## Solução

1. **Service worker v4** (`public/sw-deploy-resilience.js`):
   - Precache `/` e `/login` no install.
   - Em navegação com 502–504 ou corpo JSON/bad-gateway: serve shell em cache **ou** HTML embutido com o modal Soma + poll de `/api/health` a cada 2s e redirect para `/`.
   - Cache `soma-deploy-shell-v4`.

2. **Cliente** (`deploy-resilience.ts`):
   - Watch a cada **3s** (antes 8s).
   - Detecta payload gateway; **abre overlay imediatamente** (sem exigir 2 falhas).
   - Register `?v=4` para invalidar SW antigo.

## Arquivos

- `public/sw-deploy-resilience.js`
- `src/lib/ui/deploy-resilience.ts`

## Como validar

1. Deploy em produção; com aba já aberta: overlay deve aparecer em poucos segundos sem JSON.
2. Durante a janela de 502, F5: deve ver modal (shell ou fallback), não JSON preto.
3. Após health ok: reload automático.
4. DevTools → Application → Service Workers: `sw-deploy-resilience.js?v=4`.

## Observações

- Primeira visita sem SW ainda instalado pode ver JSON até um load bem-sucedido instalar o worker.
- Heal VPS (`heal-soma-gestao-vps.sh`) continua necessário para encurtar a janela de 502.

## Keywords

`bad-gateway`, `sw-deploy-resilience`, `fallback HTML`, `modal deploy`, `app.somaconecta.com.br`
