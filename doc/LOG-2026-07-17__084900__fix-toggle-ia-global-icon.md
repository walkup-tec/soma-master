# LOG — Toggle global de IA com ícone

## Contexto

O botão global do Inbox mostrava ícone de robô e texto `IA`.

## Alteração

- O botão agora mostra somente o ícone `Sparkles`, representando IA.
- Ligado: fundo e borda verdes.
- Desligado: fundo transparente, somente contorno e traços neutros.
- Mantidos `aria-label`, `title`, estado pressionado e spinner durante a gravação.

## Arquivo alterado

- `src/components/chat/chat-inbox-screen.tsx`

## Validação

- Diagnóstico do editor sem erros.
- Pendente: testar após deploy os estados ligado/desligado.

## Retomada

- Solicitação atual concluída.
- Alterações ainda não commitadas; aguardar pedido explícito de commit/push.

## Palavras-chave

`IA global`, `Sparkles`, `toggle IA`, `Inbox WhatsApp`
