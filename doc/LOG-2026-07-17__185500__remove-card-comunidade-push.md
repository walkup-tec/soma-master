# LOG — Remover card Comunidade WhatsApp da tela Push

**Data:** 2026-07-17 ~18:55  
**Pedido:** Tirar da tela o bloco “Comunidade WhatsApp” (link, Evolution, JID, Salvar comunidade).

## Solução

Removido o card de configuração em `src/components/push/push-screen.tsx`.  
A comunidade permanece como destino de envio e a config segue por env/defaults no backend.

## Arquivos

- `src/components/push/push-screen.tsx`
- `doc/memoria.md`

## Keywords

push, comunidade, UI, remover card
