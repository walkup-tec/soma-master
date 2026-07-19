# LOG — Números WhatsApp: só instâncias conectadas

**Data:** 2026-07-19 12:20:44  
**Repo:** Soma

## Pedido

Na aba Funil e WhatsApp → Números WhatsApp, exibir apenas instâncias conectadas.

## Solução

Filtro em `fetchWabaAquecedorInstances` por `connectionStatus` (`open` / `connected`).  
Texto da UI atualizado para deixar claro que desconectadas não entram na lista.

## Arquivos

- `src/lib/waba/waba-aquecedor.adapter.ts`
- `src/components/marketing/marketing-panels.tsx`
