function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type TemporaryPasswordEmailInput = {
  name: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
};

export function buildTemporaryPasswordEmail(input: TemporaryPasswordEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Nova senha — Sistema Sinal Verde";
  const text = [
    `Olá, ${input.name}!`,
    "",
    "Uma nova senha temporária foi gerada para sua conta no Sistema Sinal Verde.",
    "",
    `E-mail (login): ${input.email}`,
    `Senha temporária: ${input.temporaryPassword}`,
    "",
    `Acesse: ${input.loginUrl}`,
    "",
    "Altere a senha após entrar.",
    "",
    "Equipe Sinal Verde",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr><td style="background:#0f766e;padding:20px 24px;color:#fff;font-size:18px;font-weight:700;">Sistema Sinal Verde</td></tr>
    <tr><td style="padding:24px;">
      <p style="margin:0 0 12px;">Olá, <strong>${escapeHtml(input.name)}</strong>!</p>
      <p style="margin:0 0 16px;color:#4b5563;">Uma nova senha temporária foi gerada para sua conta.</p>
      <p style="margin:0 0 8px;"><strong>E-mail:</strong> ${escapeHtml(input.email)}</p>
      <p style="margin:0 0 20px;"><strong>Senha temporária:</strong> ${escapeHtml(input.temporaryPassword)}</p>
      <p style="margin:0 0 16px;"><a href="${escapeHtml(input.loginUrl)}" style="color:#0f766e;font-weight:600;">Acessar o sistema</a></p>
      <p style="margin:0;color:#6b7280;font-size:13px;">Altere a senha após entrar.</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
