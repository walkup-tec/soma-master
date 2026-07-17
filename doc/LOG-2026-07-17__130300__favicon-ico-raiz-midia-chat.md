# LOG — Favicon errado ao abrir mídia do chat

**Data:** 2026-07-17 13:03

## Contexto

Ao abrir uma imagem recebida no chat (`/api/chat/media/:id`), a aba do navegador mostrava um favicon que não era o do projeto.

## Causa raiz

Para respostas que não são HTML (imagem/PDF direto), o navegador ignora as tags `<link rel="icon">` das páginas e busca **sempre** `GET /favicon.ico` na raiz do domínio. O arquivo `public/favicon.ico` era um ícone legado (11/03/2026, 20 KB), diferente do ícone Soma atual — os PNGs (`favicon-16/32/48.png`) estavam corretos, mas o `.ico` nunca tinha sido regenerado.

## Solução

- Novo script `scripts/build-favicon-ico.mjs`: monta `public/favicon.ico` no formato PNG-in-ICO embutindo `favicon-16.png`, `favicon-32.png` e `favicon-48.png` (ícone Soma).
- Executado: `node scripts/build-favicon-ico.mjs` → `favicon.ico` com 3 tamanhos (8.829 bytes).
- Nenhuma mudança de rota é necessária: `public/` já é servido na raiz pelo Nitro, então `/favicon.ico` passa a entregar o ícone certo para qualquer URL do domínio.

## Arquivos

- `+ scripts/build-favicon-ico.mjs`
- `~ public/favicon.ico` (regenerado com o ícone Soma)

## Como validar

1. Após deploy, abrir `https://app.somaconecta.com.br/favicon.ico` — deve ser o ícone Soma.
2. Abrir uma imagem do chat em nova aba — favicon Soma na aba.
3. Se ainda aparecer o antigo, é cache do navegador (favicon é cacheado forte): Ctrl+F5 ou abrir aba anônima.

## Palavras-chave

favicon.ico, aba imagem, /api/chat/media, PNG-in-ICO, ícone raiz
