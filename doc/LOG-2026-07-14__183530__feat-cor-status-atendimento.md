# Cor nos status de atendimento

- `AttendanceStatusConfig.color` (#rrggbb)
- UI Configuracoes: color picker + previa `StatusBadge`
- Clientes/Agenda: tags com cor do status
- DB: coluna `crm.attendance_statuses.color` + backfill dos padroes

Cores padrao: Novo azul, Em atendimento amarelo, Aguardando roxo, Concluido verde, Perdido vermelho.
