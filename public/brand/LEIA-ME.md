# Branding Soma — logos oficiais

## Fonte canônica

`D:\SOMA Promotora\Sistema SOMA\`

| Arquivo | Destino no CRM |
|---------|----------------|
| `logo-claro.png` | `public/brand/logo-claro.png` |
| `Logo-escuro.png` | `public/brand/logo-escuro.png` |
| `favicon-soma.png` | `public/favicon-soma.png` (+ derivados 16/32/180/ICO) |

## Uso no app

| Surface | Arquivo |
|---------|---------|
| Fundo claro / modo claro | `logo-claro.png` (marca colorida) |
| Fundo escuro / sidebar / login brand | `logo-escuro.png` (marca branca) |

O componente `Logo` tenta nesta ordem: **PNG → WEBP → SVG** em `/brand/`, depois SVG de fallback em `src/assets/brand/`.

## Favicon

Prioridade no `<head>`: PNG oficiais (`favicon-32x32`, `favicon-soma.png`, `favicon.ico`) com cache bust `?v=3`.
Não usar `favicon-soma.svg` placeholder como first icon.
