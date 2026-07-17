# LOG — Separação visual das grandes seções do menu

## Contexto

Os títulos `PARCEIROS` e `PRODUÇÃO PRÓPRIA` tinham a mesma aparência leve dos subgrupos, tornando a hierarquia pouco evidente.

## Alteração

- `src/components/app-sidebar.tsx`
  - Cada grande seção recebe cabeçalho próprio com fundo, borda, sombra leve, peso forte e maior espaçamento entre letras.
  - A partir da segunda seção, adiciona divisória horizontal mais forte e espaçamento vertical.
  - `Em breve` recebe recuo e estilo itálico secundário.
  - Subgrupos Operação/Comercial/Gestão permanecem internos e menos destacados.

## Validação

- Lint sem erros.
- Pendente: validação visual e commit/deploy.

## Palavras-chave

`sidebar`, `seções menu`, `Parceiros`, `Produção própria`, `hierarquia visual`
