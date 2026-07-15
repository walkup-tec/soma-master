# E-mail de boas-vindas (SMTP Gmail)

## Contexto
Pedido: enviar e-mail ao criar usuario no Sistema Sinal Verde, com todos os dados registrados, usando SMTP Gmail (MAIL_MODE=smtp).

## Solucao
- Camada `src/lib/mail/`: config, adapter nodemailer, service, templates
- `createUserFn` cria o usuario e dispara boas-vindas (nome, e-mail, senha, categoria, perfil, id, criado em + link login)
- `resendPasswordFn` tambem envia a senha temporaria por e-mail
- Variaveis em `.env.local` / `.dev.vars` (nao versionadas); placeholders em `.env.example` / `.dev.vars.example`
- `load-env-file.ts` carrega `MAIL_*` / `SMTP_*` / `APP_URL`

## Validacao
- `bun run scripts/test-smtp-welcome.ts draxsistemas@gmail.com` → `{"sent":true}`

## Seguranca
- `SMTP_PASS` so em arquivos locais gitignored
- Nao logar senha/corpo do e-mail
- App password exposta no chat: rotacionar no Google se o canal nao for privado

## Arquivos
- `src/lib/mail/**`
- `src/lib/users/users.server.ts`
- `src/components/users/users-management.tsx`
- `src/lib/db/load-env-file.ts`
- `scripts/test-smtp-welcome.ts`
- `.env.example`, `.dev.vars.example`
