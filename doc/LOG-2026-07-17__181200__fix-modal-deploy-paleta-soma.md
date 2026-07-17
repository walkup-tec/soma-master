# LOG — Modal de deploy exclusivamente na identidade SOMA

**Data:** 2026-07-17 18:12

## Contexto

O modal “Atualizando o sistema” ainda usava cores e efeitos herdados do modelo DRAX (roxo, ciano e verde), fora da identidade visual da Soma Promotora.

## Alteração

- Removidos roxo, ciano, verde e gradientes multicoloridos.
- Aplicada exclusivamente a paleta oficial SOMA:
  - magenta `#be1c6a`;
  - lima `#ecf759`;
  - azul `#2775e5`;
  - neutros do tema escuro.
- Card com fundo sólido `#0e1828`, sem brilho colorido.
- Barra de progresso sólida: magenta durante o deploy e lima na estabilização.
- Tipografia alinhada ao sistema: Manrope no conteúdo e Sora no título.

## Arquivo alterado

- `src/lib/ui/deploy-resilience.ts`

## Validação

- Prettier: OK
- ESLint: OK
- `npm run build` (client + SSR): OK

## Segurança

Sem alteração em segredos, autenticação, health check ou comportamento de recuperação do deploy.

## Palavras-chave

modal deploy, atualizando sistema, paleta SOMA, identidade visual, remover DRAX, magenta lima azul
