import { getMailConfig } from "@/lib/mail/mail.config";
import { isSmtpMailEnabled, sendSmtpMail } from "@/lib/mail/smtp.adapter";
import { buildTemporaryPasswordEmail } from "@/lib/mail/templates/temporary-password-email";
import { buildWelcomeEmail } from "@/lib/mail/templates/welcome-email";

export type WelcomeUserMailInput = {
  name: string;
  email: string;
  password: string;
  categoryName: string;
  role: "master" | "user";
  userId: string;
  createdAt: string;
};

export type MailSendResult =
  | { sent: true }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; error: string };

function roleLabel(role: "master" | "user"): string {
  return role === "master" ? "Master" : "Usuário";
}

export async function sendWelcomeUserEmail(input: WelcomeUserMailInput): Promise<MailSendResult> {
  if (!isSmtpMailEnabled()) {
    return { sent: false, skipped: true, reason: "MAIL_MODE não está como smtp." };
  }

  const config = getMailConfig();
  const loginUrl = `${config.appUrl}/login`;
  const content = buildWelcomeEmail({
    name: input.name,
    email: input.email,
    password: input.password,
    categoryName: input.categoryName,
    roleLabel: roleLabel(input.role),
    userId: input.userId,
    createdAt: input.createdAt,
    loginUrl,
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

  const config = getMailConfig();
  const content = buildTemporaryPasswordEmail({
    ...input,
    loginUrl: `${config.appUrl}/login`,
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
