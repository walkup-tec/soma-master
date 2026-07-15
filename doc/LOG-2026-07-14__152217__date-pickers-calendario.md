# Date pickers com calendario

## Pedido
Filtros de clientes e modais de agendamento: selecionar data/periodo no calendario (sem digitar).

## Feito
- `DatePickerField` (data unica) + `DateRangePickerField` (periodo)
- Filtro clientes: periodo createdFrom/createdTo via calendario
- Modal bulk + modal agenda individual: DatePickerField
- Backend atualizado para periodo (>= from, <= to)

## Arquivos
- components/ui/date-picker-field.tsx, date-range-picker-field.tsx
- lib/dates/date-picker.ts
- clients-screen, client-bulk-actions-modal, client-action-modals
- clients.repository / client-bulk / clients.server / client.types
