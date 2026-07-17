# LOG — Modal de deploy: forçar identidade Soma e limpar cache SW

**Data:** 2026-07-17 18:45

## Problema

Em produção o modal “Atualizando o sistema” ainda aparecia com cores da WABA (pink/roxo/ciano), mesmo com o código fonte já na paleta Soma. Causa provável: service worker servindo shell HTML antiga com o bootstrap embutido antigo.

## Correção

1. Estilos com versão `soma-brand-v3` — se existir CSS antigo, é removido e recriado.
2. Card com marca **Soma Promotora** e cores oficiais:
   - magenta `#be1c6a`
   - lima `#ecf759`
   - azul `#2775e5` (anel do spinner)
3. Cache do SW: `soma-deploy-shell-v1` → `soma-deploy-shell-v3`
4. Registro: `/sw-deploy-resilience.js?v=3`

## Arquivos

- `src/lib/ui/deploy-resilience.ts`
- `public/sw-deploy-resilience.js`

## Keywords

modal atualizando sistema, cores WABA, cache service worker, paleta Soma
