# LOG — Anexar mídia do chat, receber PDF e abrir

**Data:** 2026-07-17 11:03

## Solicitação aberta

- Imagens recebidas no chatbot devem poder ser anexadas diretamente ao cadastro do cliente.
- A interface deve informar discretamente quando a mídia foi anexada.
- O chatbot deve receber e salvar documentos PDF.
- Imagens e PDFs recebidos devem poder ser abertos rapidamente.

## Solução implementada

1. O webhook Evolution passou a reconhecer `documentMessage` além de `imageMessage`.
2. O armazenamento de mídia recebida aceita JPG, PNG, WEBP e PDF, com limite de 10 MB.
3. O tipo de mensagem `document` foi incluído no domínio e na persistência do chat.
4. PDFs são exibidos em um cartão compacto com nome do arquivo.
5. Mídias recebidas exibem as ações `Abrir` e `Anexar imagem`/`Anexar PDF`.
6. `Abrir` reutiliza a rota autenticada `/api/chat/media/:mediaId`, com exibição inline.
7. `Anexar` copia a mídia no servidor diretamente para `client-attachments`, sem download/upload pelo navegador.
8. A ação valida sessão do Chat, vínculo conversa-cliente, pertencimento da mídia à conversa e acesso do atendente ao cliente.
9. `source_chat_media_id` e índice único por cliente evitam duplicação. A UI mostra toast discreto e troca o botão para `Anexado`.

## Arquivos alterados

- `src/lib/chat/webhook.handler.ts`
- `src/lib/chat/chat-media.repository.ts`
- `src/lib/chat/chat.types.ts`
- `src/lib/chat/chat.repository.ts`
- `src/lib/chat/chat.server.ts`
- `src/components/chat/chat-inbox-screen.tsx`
- `src/lib/clients/client-attachment.repository.ts`
- `src/lib/clients/client.types.ts`
- `src/lib/db/ensure-client-indexes.ts`
- `src/routes/api/chat/media.$mediaId.ts`

## Comandos e validações

- `npm run build` executado duas vezes após os ajustes: **OK** (client e SSR).
- Diagnósticos IDE dos arquivos alterados: **sem erros**.
- `git status --short` e `git diff --stat` revisados.

## Segurança e consistência

- Somente MIME permitidos; PDF não é inferido quando o provedor omite o MIME.
- Limite de 10 MB preservado para evitar abuso de memória e banco.
- A mídia deve pertencer à conversa informada.
- O cliente deve estar vinculado e visível para o usuário (master ou atribuição existente).
- A rota de abertura continua exigindo sessão e permissão de Chat.
- Nenhum segredo foi criado ou exposto.

## Como validar

1. Enviar uma imagem do WhatsApp para o chatbot.
2. Clicar em `Abrir` e confirmar a nova aba.
3. Clicar em `Anexar imagem`; confirmar toast e estado `Anexado`.
4. Abrir Detalhes do cliente e confirmar o arquivo na seção Anexos.
5. Repetir o clique e confirmar que não é criado duplicado.
6. Repetir o fluxo com um PDF de até 10 MB.
7. Testar conversa sem cliente vinculado e confirmar o aviso para vincular.

## Pendências para retomada

- Alterações ainda não commitadas nem publicadas.
- Teste ponta a ponta com payload real da Evolution deve ser feito após o deploy.

**Palavras-chave:** chatbot PDF, documentMessage, anexar imagem cliente, source_chat_media_id, abrir mídia
