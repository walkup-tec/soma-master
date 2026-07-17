import { getMailConfig } from "@/lib/mail/mail.config";
import { sendWelcomeUserEmail, type MailSendResult } from "@/lib/mail/mail.service";
import { sendWelcomeWhatsApp, type WhatsAppSendResult } from "@/lib/mail/welcome-whatsapp.service";

export type WelcomeNotifyInput = {
  name: string;
  /** E-mail de login (campo Usuário na mensagem). */
  email: string;
  /** Senha em texto ou código de acesso do parceiro (ex.: GE1234). */
  password: string;
  /** WhatsApp do destinatário (parceiros). Usuários sem telefone pulam o canal. */
  whatsapp?: string | null;
};

export type WelcomeNotifyResult = {
  mail: MailSendResult;
  whatsapp: WhatsAppSendResult;
};

function resolveLoginUrl(): string {
  const config = getMailConfig();
  const fromEnv = config.appUrl.trim();
  if (fromEnv && !fromEnv.includes("localhost") && !fromEnv.includes("127.0.0.1")) {
    return fromEnv;
  }
  return "https://app.somaconecta.com.br";
}

/**
 * Envia boas-vindas por e-mail (SMTP) e WhatsApp (Evolution).
 * Falha de um canal não desfaz o cadastro nem bloqueia o outro.
 */
export async function notifyWelcomeChannels(
  input: WelcomeNotifyInput,
): Promise<WelcomeNotifyResult> {
  const loginUrl = resolveLoginUrl();
  const usuario = input.email.trim().toLowerCase();
  const senha = input.password.trim();

  const [mail, whatsapp] = await Promise.all([
    sendWelcomeUserEmail({
      name: input.name,
      email: usuario,
      password: senha,
      loginUrl,
    }),
    input.whatsapp?.trim()
      ? sendWelcomeWhatsApp({
          usuario,
          senha,
          loginUrl,
          whatsapp: input.whatsapp,
        })
      : Promise.resolve({
          sent: false as const,
          skipped: true as const,
          reason: "WhatsApp não informado no cadastro.",
        }),
  ]);

  return { mail, whatsapp };
}
