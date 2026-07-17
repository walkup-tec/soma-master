# LOG — Push comunidade Evolution HTTP 400

**Data:** 2026-07-17 ~20:05  
**Sintoma:** Push Parcial — `Comunidade: falhou — Evolution HTTP 400` (sem detalhe).

## Correções

1. Erro Evolution passa a incluir o body (`response.message`).
2. `sendText` tenta payload `{text}` e fallback `{textMessage:{text}}` em 400 de formato.
3. Em 400 no envio à comunidade: rediscovery do JID de Anúncios (lista de grupos) e retry.
4. Preferir grupo de Anúncios via `fetchAllGroups` em vez de só inviteInfo.

## Easypanel

Se persistir 400, definir `SOMA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID` com o JID do grupo **Anúncios** (não o convite genérico da comunidade).

## Keywords

push 400, evolution, comunidade, textMessage
