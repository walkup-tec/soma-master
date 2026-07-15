# Retorno Automatico por status

- Campo `autoReturnDays` em `AttendanceStatusConfig` + coluna `auto_return_days`
- UI: select Retorno Automatico (Desligado / N dias)
- Ao mudar status com retorno: `saveClientSchedule` para o usuario que atribuiu + assignment
- Nota no historico menciona a data do retorno
- Default: Aguardando retorno = 3 dias
