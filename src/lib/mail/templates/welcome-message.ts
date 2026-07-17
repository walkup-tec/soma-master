/** Conteúdo compartilhado de boas-vindas (e-mail + WhatsApp). */

export type WelcomeMessageInput = {
  /** Login (e-mail). */
  usuario: string;
  /** Senha em texto (usuário) ou código de acesso completo do parceiro (ex.: GE1234). */
  senha: string;
  /** URL do sistema (sem barra final). */
  loginUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Texto plano (e-mail text/plain e base do WhatsApp). */
export function buildWelcomeMessageText(input: WelcomeMessageInput): string {
  const usuario = input.usuario.trim();
  const senha = input.senha.trim();
  const loginUrl = input.loginUrl.trim().replace(/\/$/, "") || "https://app.somaconecta.com.br";

  return [
    "Olá! 👋",
    "",
    "Seja muito bem-vindo(a) à Soma Promotora!",
    "",
    "Agradecemos pela confiança e por realizar o seu cadastro conosco. É um prazer tê-lo(a) como nosso parceiro(a), e estamos à disposição para ajudá-lo(a) a alcançar excelentes resultados.",
    "",
    "Abaixo estão os seus dados de acesso ao sistema:",
    "",
    `🔑 Usuário: ${usuario}`,
    `🔒 Senha: ${senha}`,
    "",
    "🌐 Acesse o sistema:",
    loginUrl,
    "",
    "Recomendamos que, no primeiro acesso, você altere sua senha para uma de sua preferência, garantindo ainda mais segurança para sua conta.",
    "",
    "Se precisar de qualquer suporte ou tiver alguma dúvida, nossa equipe estará pronta para atendê-lo.",
    "",
    "Desejamos muito sucesso em nossa parceria!",
    "",
    "Atenciosamente,",
    "",
    "Soma Promotora",
  ].join("\n");
}

/** WhatsApp: negrito com *asteriscos* (Markdown do WhatsApp). */
export function buildWelcomeWhatsAppText(input: WelcomeMessageInput): string {
  const usuario = input.usuario.trim();
  const senha = input.senha.trim();
  const loginUrl = input.loginUrl.trim().replace(/\/$/, "") || "https://app.somaconecta.com.br";

  return [
    "Olá! 👋",
    "",
    "Seja muito bem-vindo(a) à *Soma Promotora*!",
    "",
    "Agradecemos pela confiança e por realizar o seu cadastro conosco. É um prazer tê-lo(a) como nosso parceiro(a), e estamos à disposição para ajudá-lo(a) a alcançar excelentes resultados.",
    "",
    "Abaixo estão os seus dados de acesso ao sistema:",
    "",
    `*🔑 Usuário:* ${usuario}`,
    `*🔒 Senha:* ${senha}`,
    "",
    "*🌐 Acesse o sistema:*",
    loginUrl,
    "",
    "Recomendamos que, no primeiro acesso, você altere sua senha para uma de sua preferência, garantindo ainda mais segurança para sua conta.",
    "",
    "Se precisar de qualquer suporte ou tiver alguma dúvida, nossa equipe estará pronta para atendê-lo.",
    "",
    "Desejamos muito sucesso em nossa parceria!",
    "",
    "Atenciosamente,",
    "",
    "*Soma Promotora*",
  ].join("\n");
}

export function buildWelcomeEmailContent(input: WelcomeMessageInput): {
  subject: string;
  text: string;
  html: string;
} {
  const usuario = input.usuario.trim();
  const senha = input.senha.trim();
  const loginUrl = input.loginUrl.trim().replace(/\/$/, "") || "https://app.somaconecta.com.br";
  const text = buildWelcomeMessageText(input);

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
              <div style="color:#ecfdf5;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Soma Promotora</div>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.3;">Bem-vindo(a)!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;color:#111827;font-size:15px;line-height:1.65;">
              <p style="margin:0 0 16px;">Olá! 👋</p>
              <p style="margin:0 0 16px;">
                Seja muito bem-vindo(a) à <strong>Soma Promotora</strong>!
              </p>
              <p style="margin:0 0 16px;color:#4b5563;">
                Agradecemos pela confiança e por realizar o seu cadastro conosco. É um prazer tê-lo(a) como nosso parceiro(a), e estamos à disposição para ajudá-lo(a) a alcançar excelentes resultados.
              </p>
              <p style="margin:0 0 12px;">Abaixo estão os seus dados de acesso ao sistema:</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#374151;width:40%;">🔑 Usuário</td>
                  <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;font-weight:700;">${escapeHtml(usuario)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 14px;color:#374151;">🔒 Senha</td>
                  <td style="padding:12px 14px;font-weight:700;font-family:ui-monospace,Consolas,monospace;">${escapeHtml(senha)}</td>
                </tr>
              </table>
              <p style="margin:0 0 8px;"><strong>🌐 Acesse o sistema:</strong></p>
              <p style="margin:0 0 20px;text-align:center;">
                <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;">
                  ${escapeHtml(loginUrl)}
                </a>
              </p>
              <p style="margin:0 0 16px;color:#4b5563;font-size:14px;">
                Recomendamos que, no primeiro acesso, você altere sua senha para uma de sua preferência, garantindo ainda mais segurança para sua conta.
              </p>
              <p style="margin:0 0 16px;color:#4b5563;font-size:14px;">
                Se precisar de qualquer suporte ou tiver alguma dúvida, nossa equipe estará pronta para atendê-lo.
              </p>
              <p style="margin:0 0 16px;color:#4b5563;font-size:14px;">
                Desejamos muito sucesso em nossa parceria!
              </p>
              <p style="margin:0;color:#111827;font-size:14px;">
                Atenciosamente,<br /><strong>Soma Promotora</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;">
              Este é um e-mail automático — não responda.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: "Bem-vindo(a) à Soma Promotora",
    text,
    html,
  };
}
