# LOG — Boas-vindas por e-mail e WhatsApp (usuário e parceiro)

**Data:** 2026-07-17 17:45
**Contexto:** Ao criar usuário ou parceiro, enviar mensagem de boas-vindas por e-mail (SMTP) e WhatsApp (Evolution), com o texto padrão Soma Promotora.

## Solução

1. Template compartilhado `welcome-message.ts` (texto, WhatsApp com `*negrito*`, HTML com `<strong>`).
2. `notifyWelcomeChannels` dispara e-mail + WhatsApp em paralelo; falha de um canal não desfaz o cadastro.
3. Hooks:
   - `createUserFn` → e-mail (usuários internos sem WhatsApp no cadastro → WA skipped).
   - `createPartnerFn` → e-mail + WhatsApp do parceiro; senha = código de acesso (ex. `GE1234`).
4. SMTP: usa `MAIL_*` / `SMTP_*` do Easypanel; aceita fallback `SMP_PASS` (typo comum).
5. Login URL padrão: `https://app.somaconecta.com.br` (ou `APP_URL` se não for localhost).

## Campos da mensagem

- **Usuário:** e-mail de login
- **Senha:** senha digitada (usuário) ou código completo alias+4 dígitos (parceiro)

## Arquivos

- `src/lib/mail/templates/welcome-message.ts` (novo)
- `src/lib/mail/templates/welcome-email.ts`
- `src/lib/mail/welcome-whatsapp.service.ts` (novo)
- `src/lib/mail/welcome-notify.service.ts` (novo)
- `src/lib/mail/mail.service.ts`, `mail.config.ts`
- `src/lib/users/users.server.ts`, `src/lib/partners/partners.server.ts`
- UI toasts em usuários e parceiros
- `.env.example` (MAIL_FROM Soma Promotora; sem senha)

## Validação

- prettier + eslint + `npm run build` OK

## Segurança

- Senha SMTP **não** commitada; só env no Easypanel (`SMTP_PASS`).
- Logs não incluem corpo com senha.

## Checklist Easypanel

Confirmar no serviço `gestao-interno`:

```
MAIL_MODE=smtp
MAIL_FROM=Soma Promotora <somaconecta@gmail.com>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=somaconecta@gmail.com
SMTP_PASS=<app password Gmail>
APP_URL=https://app.somaconecta.com.br
EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE=soma-crm
```

Atenção: use `SMTP_PASS` (não só `SMP_PASS`).

## Keywords

boas-vindas, welcome email, welcome whatsapp, SMTP Gmail, Evolution sendText, createPartner, createUser, Soma Promotora
