# LOG — Fix lentidao navegacao sidebar (v2)

## Contexto
Menus laterais demoravam muito para trocar de tela.

## Causas
1. enrichSession consultava DB/settings ANTES do cache (cache inutil).
2. ENRICH_TTL era 10s.
3. defaultPreloadStaleTime=0 anulava preload=intent (refetch no clique).
4. ALTER TABLE rodava em todo cold load de settings.

## Fix
- Cache-first na sessao + TTL 60s
- defaultPreload + defaultPreloadStaleTime 30s
- pending UI no /app
- DDL de settings so uma vez por processo
- chat staleTime 15s

## Keywords
lentidao, sidebar, preload, enrichSession, navegacao
