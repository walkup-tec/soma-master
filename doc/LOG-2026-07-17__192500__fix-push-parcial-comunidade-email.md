# LOG — Fix Push parcial (comunidade + e-mail)

**Data:** 2026-07-17 ~19:25  
**Sintoma:** Comunicado com status Parcial; não chegou na comunidade nem por e-mail.

## Causas prováveis

1. **Comunidade:** JID de anúncios ausente + `fetchAllGroups` lento/timeout na Evolution; envio sem `instanceName` explícito.
2. **E-mail:** SMTP off ou falha tratada como “skip” (não marcava falha); envio paralelo estourava Gmail.

## Correções

- Resolver JID via `inviteInfo` (código do link) antes de listar todos os grupos.
- Passar `instanceName` (`soma-crm`) em `sendText`/`sendMedia`.
- E-mail sequencial; SMTP off / 0 enviados = falha; `detail` no resultado.
- Histórico e toast mostram motivo da falha.

## Produção (Easypanel)

Garantir:

```
MAIL_MODE=smtp
MAIL_FROM=...
SMTP_*
SOMA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID=<jid>@g.us
EVOLUTION_INSTANCE=soma-crm
```

## Keywords

push parcial, comunidade, email smtp, jid anúncios, inviteInfo
