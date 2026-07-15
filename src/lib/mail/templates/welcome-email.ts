function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export type WelcomeEmailInput = {
  name: string;
  email: string;
  password: string;
  categoryName: string;
  roleLabel: string;
  userId: string;
  createdAt: string;
  loginUrl: string;
};

export function buildWelcomeEmail(input: WelcomeEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Bem-vindo ao Sistema Sinal Verde";
  const createdAtLabel = formatCreatedAt(input.createdAt);

  const text = [
    `Olá, ${input.name}!`,
    "",
    "Sua conta no Sistema Sinal Verde foi criada com sucesso.",
    "",
    "Dados do usuário:",
    `- Nome: ${input.name}`,
    `- E-mail (login): ${input.email}`,
    `- Senha: ${input.password}`,
    `- Categoria: ${input.categoryName}`,
    `- Perfil: ${input.roleLabel}`,
    `- ID: ${input.userId}`,
    `- Criado em: ${createdAtLabel}`,
    "",
    `Acesse o sistema: ${input.loginUrl}`,
    "",
    "Por segurança, altere sua senha após o primeiro acesso.",
    "",
    "Equipe Sinal Verde",
  ].join("\n");

  const rows: Array<[string, string]> = [
    ["Nome", input.name],
    ["E-mail (login)", input.email],
    ["Senha", input.password],
    ["Categoria", input.categoryName],
    ["Perfil", input.roleLabel],
    ["ID", input.userId],
    ["Criado em", createdAtLabel],
  ];

  const tableRows = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;width:36%;">${escapeHtml(label)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#0f766e;padding:24px 28px;">
              <div style="color:#ecfdf5;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Sistema Sinal Verde</div>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.3;">Bem-vindo(a)!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
                Olá, <strong>${escapeHtml(input.name)}</strong>!
              </p>
              <p style="margin:0 0 20px;color:#4b5563;font-size:15px;line-height:1.6;">
                Sua conta no <strong>Sistema Sinal Verde</strong> foi criada. Abaixo estão todos os dados registrados para o seu acesso.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                ${tableRows}
              </table>
              <p style="margin:24px 0 16px;text-align:center;">
                <a href="${escapeHtml(input.loginUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;">
                  Acessar o sistema
                </a>
              </p>
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
                Por segurança, altere sua senha após o primeiro acesso.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;">
              Equipe Sinal Verde · este é um e-mail automático, não responda.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
