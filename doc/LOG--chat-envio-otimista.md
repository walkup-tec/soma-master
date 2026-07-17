# LOG — Chat lento no Enter

## Causa
UI esperava join+DB+Evolution(45s)+reload thread antes de limpar input.

## Fix a873ac3→novo
- Optimistic UI
- join skip se ja atendente
- timeout sendText 12s
- sem openConversation apos send
