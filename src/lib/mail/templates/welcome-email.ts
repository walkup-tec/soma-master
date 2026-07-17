import {
  buildWelcomeEmailContent,
  type WelcomeMessageInput,
} from "@/lib/mail/templates/welcome-message";

export type WelcomeEmailInput = WelcomeMessageInput;

/** Template de boas-vindas (padrão Soma Promotora). */
export function buildWelcomeEmail(input: WelcomeEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  return buildWelcomeEmailContent(input);
}
