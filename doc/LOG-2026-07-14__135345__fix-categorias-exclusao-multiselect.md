# Fix categorias: exclusao + multi-select

## Contexto
- Lixeira em Editar categoria parecia nao excluir.
- Pedido: selecionar varias categorias e excluir todas de uma vez.

## Causa
- Persistencia ia direto ao Supabase sem estado otimista; save demora (seed/indexes) e UI so atualizava no retorno.
- Erros do `saveSystemSettingsFn` eram engolidos (`void setSettings`) sem toast.

## Solucao
- `user-categories-settings.tsx`: estado local + persist async com toast (padrao de Produtos).
- Checkbox por categoria; botao **Excluir selecionadas (N)**.
- Confirmacao via AlertDialog (unica ou lote).
- Categoria Master (`cat-master`) protegida.
- `configuracoes.tsx` passa `onChange={setSettings}` (Promise).

## Arquivos
- `src/components/settings/user-categories-settings.tsx`
- `src/routes/app/configuracoes.tsx`

## Validacao
- Abrir Configuracoes > Categorias
- Excluir uma categoria (lixeira) e confirmar toast + remocao na lista
- Marcar varias e usar Excluir selecionadas
