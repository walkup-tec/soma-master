# LOG — Auditoria pós-deploy Soma (c1370af / 44e7ce6)

**Data:** 2026-07-17 ~19:45  
**Pedido:** Verificar se subiu tudo após deploys.

## Git

- `origin/main` = `44e7ce6` (igual ao HEAD local)
- Commits de produto no ar:
  - `d380330` — push parcial, categorias, bancos/produtos wizard
  - `c1370af` — senha visível, link, ícone copiar
  - `44e7ce6` — redeploy vazio `[c1370af]`

## Pendente local (não falta em produção)

Só reformatação (prettier/CRLF) em LOGs antigos, scripts e alguns `.ts` — **sem mudança funcional**.

## Env (não vai no Git — checar no Easypanel)

- `SOMA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID`
- `MAIL_MODE=smtp` + SMTP_*

## Keywords

auditoria deploy, c1370af, 44e7ce6
