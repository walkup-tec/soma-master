# LOG — Agenda/Remarketing para atendente após importação

## Contexto
Importação com distribuição + data de agendamento não refletia corretamente na Agenda/Remarketing do atendente escolhido (agenda ficava ligada ao usuário que importou).

## Solução
1. `resolveScheduleActor` — dono do `client_schedules` = atendente da distribuição (não o master importador)
2. Escopo Agenda/Remarketing (não-master): `sch.user_id = usuário` **OU** assignment do cliente
3. Import job / import sync / cadastro manual usam o actor resolvido

## Arquivos
- `src/lib/clients/clients.repository.ts`
- `src/lib/clients/import-job.service.ts`
- `src/components/clients/lead-distribution-form.tsx`

## Como validar
1. Importar planilha → distribuição para um atendente + Agendamento Contato
2. Logar como esse atendente → Agenda/Remarketing no filtro da data

## Keywords
importação, agenda, remarketing, resolveScheduleActor, client_assignments
