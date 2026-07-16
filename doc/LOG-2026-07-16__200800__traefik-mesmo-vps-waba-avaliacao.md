# LOG — Traefik WABA × Soma

**Data:** 2026-07-16 ~20:08  
**Pedido:** Verificar memória Traefik do WABA e se o Soma precisa de ação semelhante.

## Contexto

No WABA houve série de quedas Traefik (404 órfão por `web`/`websecure`, 502 pós-redeploy por publish perdido, thrash de timers, force derrubando `:443`). Usuário perguntou se o deploy Soma precisa da mesma prevenção.

## Verificação

| Host | IP (1.1.1.1) | HTTP |
|------|----------------|------|
| `soma-promotora-app.achpyp.easypanel.host` | 72.60.51.127 | **502** |
| `app.somaconecta.com.br` | 72.60.51.127 | **404** (JSON Easypanel/Traefik) |
| Evolution `walkup-evo-…achpyp…` | 72.60.51.127 | (mesmo VPS) |
| `wabadisparos.com.br` | — | **200** (Traefik OK) |

Conclusão: **mesmo Traefik/VPS que WABA**. Traefik não está “morto”; o serviço Soma ainda não está saudável / domínio custom sem router útil.

## Fontes WABA consultadas

- `doc/memoria.md` (incidentes 502 overlay, entrypoints, login heal, thrash)
- Rules: `ucp-traefik-static-dynamic.mdc`, `traefik-entrypoints-http-https.mdc`
- Doc oficial: Traefik config overview (static vs dynamic); Easypanel custom Traefik config

## O que fazer no Soma

1. **Agora (painel):** Redeploy até host Easypanel `/login` = 200; domínio `app.somaconecta.com.br` → HTTP **3000**; primary.
2. **Higiene:** Rule `soma-traefik-mesmo-vps-waba.mdc` — não force Traefik; não patch `websecure`; não instalar heals WABA cegamente.
3. **Depois (só se 502 pós-redeploy recorrente):** heal **específico** da porta publicada do `gestao-interno` (não copiar 30180).

## O que NÃO fazer

- Copiar `heal-waba-login` / landings / permanent-fix 20s para “proteger o Soma”.
- Editar `main.yaml` sem inspeção — risco de derrubar WABA + Soma juntos.

## Arquivos

- Criado: `.cursor/rules/soma-traefik-mesmo-vps-waba.mdc`
- Atualizado: `doc/memoria.md`
- Este LOG
