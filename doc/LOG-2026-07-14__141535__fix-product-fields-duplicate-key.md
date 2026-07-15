# Fix product_fields duplicate key

## Sintoma
Marcar campo Nome como obrigatorio em Editar produto → alerta `duplicate key value violates unique constraint "product_fields_pkey"`.

## Causa
Saves concurrentes (cliques/react) faziam DELETE + INSERT em paralelo no `crm.product_fields`.

## Fix
- `ON CONFLICT (product_id, field_id) DO UPDATE` no sync de produtos
- Fila serializada de persist no `products-settings.tsx`
- `ON CONFLICT DO NOTHING` em menus de categoria (prevencao)

## Arquivos
- settings.repository.ts
- products-settings.tsx
