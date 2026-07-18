# LOG — Remover texto explicativo WhatsApp no modal de export

## Contexto
Usuário pediu para não exibir a frase sobre formato WhatsApp/DDI 55/Evolution no modal de ações em lote.

## Alteração
- `client-bulk-actions-modal.tsx`: mantém só “Gera um arquivo Excel…”; toast sem menção a EVO.
- Formato WhatsApp no arquivo Excel permanece inalterado.

## Keywords
export, excel, modal, copy, whatsapp
