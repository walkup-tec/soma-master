# LOG — Fix botão Atribuir não clicável

**Data:** 2026-07-19 11:36:01  
**Repo:** Soma

## Problema

Botão **Atribuir** aparecia mas não respondia ao clique.

## Causa

O `Button` do design system usa `disabled:pointer-events-none`. O botão ficava `disabled` quando:

1. `!active` (thread ainda carregando / estado incompleto), ou
2. `isAssignedToMe` (virava “Meu” sem parecer status — ou falhava a detecção com `active` nulo).

## Correção

- Usa conversa da lista como fallback (`selectedConversation`), não só `active`.
- Se já é meu → badge **Meu** (não é botão desabilitado).
- Se não é meu → botão **Atribuir** / **Atribuir a mim** clicável; só desabilita durante o request (`assigning`).
- `z-20` + `pointer-events-auto` no header/botão.
- Subtitle de atribuição baseado em `assignedUserId`, não só no nome.

## Arquivo

- `src/components/chat/chat-inbox-screen.tsx`
