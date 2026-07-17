# LOG — Soma bad-gateway pós-deploy (2026-07-17 ~09:01)

## Contexto

Após push `a0fccae` (controles IA chatbot), o usuário abriu `https://app.somaconecta.com.br` e viu JSON:

```json
{
  "status": 404,
  "error": "Not Found",
  "response": { "message": ["Cannot GET /api/errors/bad-gateway"] }
}
```

Isso **não** é rota do app: é página de erro do proxy (Easypanel/Traefik) quando o backend fica inacessível — padrão pós-Redeploy (publish `:30300` some e/ou URL overlay no `main.yaml`).

## Diagnóstico (esta máquina, ~09:01 BRT)

| Probe | Resultado |
|-------|-----------|
| `https://app.somaconecta.com.br/` | `307` |
| `https://app.somaconecta.com.br/login` | `200` |

Indica recuperação parcial/já saudável no momento da checagem (heal timer/watch ou fim do redeploy).

## Ação canônica (VPS)

```bash
/root/waba-infra/heal-soma-gestao-vps.sh burst
# ou, se o script estiver só em /tmp:
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/soma-master/main/scripts/heal-soma-gestao-vps.sh" -o /tmp/heal-soma-gestao-vps.sh
sed -i 's/\r$//' /tmp/heal-soma-gestao-vps.sh
chmod +x /tmp/heal-soma-gestao-vps.sh
/tmp/heal-soma-gestao-vps.sh burst
/tmp/heal-soma-gestao-vps.sh status
```

## Observações

- Não reiniciar Traefik com `--force` por hábito.
- Confirmar watch+timer: `systemctl is-active soma-gestao-heal.timer` / unidade do script `install`.
- Keywords: bad-gateway, 30300, heal-soma, pós-redeploy, app.somaconecta.com.br
