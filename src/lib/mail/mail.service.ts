import { getMailConfig } from "@/lib/mail/mail.config";
import { isSmtpMailEnabled, sendSmtpMail } from "@/lib/mail/smtp.adapter";
import { buildTemporaryPasswordEmail } from "@/lib/mail/templates/temporary-password-email";
import { buildWelcomeEmail } from "@/lib/mail/templates/welcome-email";

export type WelcomeUserMailInput = {
  name: string;
  email: string;
  password: string;
  /** URL de acesso; se omitida, usa APP_URL / produção Soma. */
  loginUrl?: string;
  communityLink?: string;
  /** @deprecated Mantido por compatibilidade; o template atual não exibe categoria. */
  categoryName?: string;
  /** @deprecated Mantido por compatibilidade; o template atual não exibe perfil. */
  role?: "master" | "user";
  /** @deprecated Mantido por compatibilidade; o template atual não exibe ID. */
  userId?: string;
  /** @deprecated Mantido por compatibilidade; o template atual não exibe data. */
  createdAt?: string;
};

export type MailSendResult =
  | { sent: true }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; error: string };

function resolveLoginUrl(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim().replace(/\/$/, "");
  const config = getMailConfig();
  const fromEnv = config.appUrl.trim();
  if (fromEnv && !fromEnv.includes("localhost") && !fromEnv.includes("127.0.0.1")) {
    return fromEnv;
  }
  return "https://app.somaconecta.com.br";
}

export async function sendWelcomeUserEmail(input: WelcomeUserMailInput): Promise<MailSendResult> {
  if (!isSmtpMailEnabled()) {
    return { sent: false, skipped: true, reason: "MAIL_MODE não está como smtp." };
  }

  const loginUrl = resolveLoginUrl(input.loginUrl);
  const content = buildWelcomeEmail({
    usuario: input.email,
    senha: input.password,
    loginUrl,
    communityLink: input.communityLink,
  });

  try {
    await sendSmtpMail({
      to: input.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      error: error instanceof Error ? error.message : "Falha ao enviar e-mail de boas-vindas.",
    };
  }
}

export async function sendTemporaryPasswordEmail(input: {
  name: string;
  email: string;
  temporaryPassword: string;
}): Promise<MailSendResult> {
  if (!isSmtpMailEnabled()) {
    return { sent: false, skipped: true, reason: "MAIL_MODE não está como smtp." };
  }

  const loginUrl = resolveLoginUrl();
  const content = buildTemporaryPasswordEmail({
    ...input,
    loginUrl: `${loginUrl}/login`,
  });

  try {
    await sendSmtpMail({
      to: input.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      error: error instanceof Error ? error.message : "Falha ao enviar e-mail de senha.",
    };
  }
}
