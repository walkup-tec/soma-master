# LOG — Submenu Funil e WhatsApp em Produção própria

## Contexto
Adicionar subgrupo **Funil e WhatsApp** na seção Produção própria (sem importar Aquecedor/API Alternativa).

## Solução
1. Novo `MenuGroupId`: `"Funil e WhatsApp"`.
2. Ordem dos grupos: Operação → Comercial → Funil e WhatsApp → Gestão.
3. Item **Chat WhatsApp** movido de Comercial para esse subgrupo (assim o label aparece no sidebar e nas categorias).

## Arquivos
- `src/lib/config/menu-items.ts`

## Keywords
menu, funil, whatsapp, producao-propria, submenu, chat
