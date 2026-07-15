# Bootstrap Projeto Soma — cópia do CRM Sinal Verde

**Data:** 2026-07-14  
**Repo:** https://github.com/walkup-tec/soma-master  
**Pasta local:** `D:\Soma`

## Contexto

Iniciar o Projeto Soma copiando integralmente o CRM Sinal Verde (`D:\CRM-SinalVerde`, origin antigo `sinal-verde-pro`) para pasta e repositório novos. Alterações de marca/produto ficam para etapas seguintes.

## Ações executadas

1. Robocopy `D:\CRM-SinalVerde` → `D:\Soma` (excluiu `node_modules`, `dist`, `.wrangler`, `.tanstack`, `.dev.vars`, `.env.local`).
2. `git remote set-url origin https://github.com/walkup-tec/soma-master.git`
3. Reforço de `.gitignore` para repo público (env, uploads, anexos, xlsx, Reuniões).
4. Commit bootstrap com alterações locais pendentes do CRM: `9d88ecf`
5. `git push -u origin main`

## Arquivos relevantes

- `.gitignore` — proteção de segredos/dados locais
- Histórico Git preservado a partir do CRM + 1 commit bootstrap

## Validação

- Abrir pasta `D:\Soma` no Cursor
- Conferir GitHub: https://github.com/walkup-tec/soma-master
- Local: `bun install` (ou npm) + copiar `.env.example` / `.dev.vars.example` antes de `bun run dev`

## Segurança

- Não versionados: `.dev.vars`, `.env*`, `data/uploads`, `data/client-attachments`, planilhas xlsx, Reuniões
- CRM original em `D:\CRM-SinalVerde` permanece intacto

## Palavras-chave

`soma`, `soma-master`, `bootstrap`, `crm-sinal-verde`, `copia-projeto`, `walkup-tec`
