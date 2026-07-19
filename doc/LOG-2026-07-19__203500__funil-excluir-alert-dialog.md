# LOG — Confirmação exclusão funil via AlertDialog

**Data:** 2026-07-19 ~20:35 BRT

## Contexto

Ao excluir funil, aparecia `window.confirm` nativo do navegador ("app.somaconecta.com.br diz"). Padrão Soma: `AlertDialog` in-app (igual produtos, usuários, tabelas de parceiro).

## Solução

`MarketingFunnelPanel` guarda `funnelPendingDelete` e abre `AlertDialog` com Cancelar / Excluir. Toast de sucesso/erro permanece.

## Arquivos

- `src/components/marketing/marketing-panels.tsx`

## Deploy

Commit: `7b86fe5`

## Keywords

funil, excluir, AlertDialog, window.confirm
