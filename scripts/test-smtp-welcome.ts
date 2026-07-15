/**
 * Teste pontual do SMTP + template de boas-vindas.
 * Uso: bun run scripts/test-smtp-welcome.ts destino@email.com
 */
import { sendWelcomeUserEmail } from "../src/lib/mail/mail.service";

const to = process.argv[2]?.trim();
if (!to) {
  console.error("Informe o e-mail de destino: bun run scripts/test-smtp-welcome.ts voce@email.com");
  process.exit(1);
}

const result = await sendWelcomeUserEmail({
  name: "Usuário Teste",
  email: to,
  password: "SenhaTemporaria123",
  categoryName: "Comercial",
  role: "user",
  userId: "user-test",
  createdAt: new Date().toISOString(),
});

console.log(JSON.stringify(result, null, 2));
if (result.sent !== true) process.exit(1);
