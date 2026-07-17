# LOG — Push / Comunicados portado da WABA para o Soma

**Data:** 2026-07-17 18:35

## Contexto

Portar o recurso de Push da WABA: sininho no topo + tela de composição sob Gestão, com comunidade WhatsApp própria da Soma.

## Comunidade Soma (não é a da WABA/DRAX)

- Link: `https://chat.whatsapp.com/HOArsOldAKREFg23isS3ZT`
- Instância Evolution `soma-crm` é admin/proprietária desta comunidade.

## O que foi entregue

1. **Menu Gestão → Push** (`/app/push`) — master only
2. **Sininho** no topbar (`PushTopbarBell`) — comunicados pendentes, marcar como lido
3. **Composição** — título, texto, revisar com IA, imagem (só comunidade), destinos:
   - Usuários (master/user)
   - Parceiros ativos
   - Comunidade WhatsApp
   - E-mail (SMTP)
4. **Config da comunidade** — link, instância EVO, JID de anúncios (opcional; auto-descoberta)
5. **Boas-vindas** — e-mail e WhatsApp passam a incluir o link da comunidade Soma
6. Evolution `sendText`/`sendMedia` preservam JID `@g.us` (necessário para grupo)

## Arquivos principais

- `src/lib/push/*`
- `src/components/push/push-screen.tsx`
- `src/components/push/push-topbar-bell.tsx`
- `src/routes/app/push.tsx`
- `src/routes/api/push/media.$mediaId.ts`
- `src/lib/config/menu-items.ts` / `menu-nav.tsx`
- `src/components/app-topbar.tsx`

## Persistência

- `data/soma-push-messages.json`
- `data/soma-push-config.json`
- `data/push-media/`

## Env (Easypanel)

```
SOMA_PUSH_COMMUNITY_INVITE_LINK=https://chat.whatsapp.com/HOArsOldAKREFg23isS3ZT
SOMA_PUSH_COMMUNITY_EVO_INSTANCE=soma-crm
SOMA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID=   # opcional
```

## Validação

- Prettier + ESLint + `npm run build` (client + SSR): OK

## Keywords

push, comunicados, sininho, comunidade whatsapp, HOArsOldAKREFg23isS3ZT, gestão, soma-crm
