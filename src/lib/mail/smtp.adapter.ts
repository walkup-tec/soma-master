import nodemailer from "nodemailer";
import { assertSmtpReady, getMailConfig, type MailConfig } from "@/lib/mail/mail.config";

export type SendMailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function createTransport(config: MailConfig) {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

/** Adapter SMTP (nodemailer). Não loga credenciais nem corpo com senha. */
export async function sendSmtpMail(payload: SendMailPayload): Promise<void> {
  const config = getMailConfig();
  assertSmtpReady(config);

  const transporter = createTransport(config);
  try {
    await transporter.sendMail({
      from: config.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no SMTP.";
    throw new Error(`Não foi possível enviar o e-mail (${message}).`);
  } finally {
    transporter.close();
  }
}

export function isSmtpMailEnabled(): boolean {
  return getMailConfig().mode === "smtp";
}
