# LOG — Atribuição só no botão Atribuir (regras Meus / Não atribuídos / Todos)

**Data:** 2026-07-19 11:47:09  
**Repo:** Soma

## Problema

No print: contato já “Atribuído: Walkup” + selo **Meu** sem o usuário ter usado **Atribuir**. O botão de atribuição não seguia as regras.

## Regras

| Filtro | Conteúdo |
|--------|----------|
| **Meus** | Só os que o usuário **atribuir** (botão) |
| **Não atribuídos** | Sem `assignedUserId` |
| **Todos** | Todos |

## Causa

1. **Enviar mensagem/imagem** chamava `joinConversationAsAgent` → atribuía sozinho.
2. UI otimista também setava `assignedUserId` no envio.
3. Quando já era “Meu”, o botão virava selo **não clicável** (sem como voltar a Não atribuídos).

## Correção

- Envio de texto/imagem **não atribui** mais (só pausa IA).
- **Atribuir** → `joinChat` → muda para filtro **Meus**.
- Se já é meu: selo **Meu** + botão **Remover** → `unassign` → filtro **Não atribuídos**.
- Sem atribuição otimista no envio.
- Novo: `unassignConversation` / `unassignChatConversationFn`.

## Arquivos

- `src/components/chat/chat-inbox-screen.tsx`
- `src/lib/chat/chat.server.ts`
- `src/lib/chat/chat.repository.ts`

## Validar

1. Contato sem dono → **Não atribuídos** → **Atribuir** → aparece em **Meus**.
2. Enviar mensagem **sem** clicar Atribuir → continua Não atribuído.
3. Em Meus → **Remover** → volta a Não atribuídos.
