# LOG — AppTopbar tema escuro + site 404/502

## Contexto
Usuario reportou tela JSON `Cannot GET /api/errors/bad-gateway` em app.somaconecta.com.br/app (Traefik/Easypanel apos redeploy). Tema escuro sumia apos Atualizar status.

## Acoes
- Confirmado: AppTopbar ainda tinha `useState(false)` + effect que apagava dark no mount
- Reescrito `src/components/app-topbar.tsx`: init do DOM/localStorage, MutationObserver, `persistSomaTheme`
- Push: `110beb2` em soma-master/main

## Validar
1. VPS: `/root/heal-soma-gestao-vps.sh burst` (ou install se ainda nao)
2. Easypanel Redeploy gestao-interno
3. Login + dark + Atualizar status EVO — overlay Processando e dark permanece

## Keywords
app-topbar, tema escuro, bad-gateway, heal-soma, Traefik 502
