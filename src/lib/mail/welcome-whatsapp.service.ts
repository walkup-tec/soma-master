import { evolutionSendText, isEvolutionConfigured } from "@/lib/chat/evolution.adapter";
import { normalizeWhatsAppPhone } from "@/lib/chat/phone";
import { buildWelcomeWhatsAppText } from "@/lib/mail/templates/welcome-message";

export type WelcomeWhatsAppInput = {
  usuario: string;
  senha: string;
  loginUrl: string;
  whatsapp: string;
  communityLink?: string;
};

export type WhatsAppSendResult =
  | { sent: true }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; error: string };

export async function sendWelcomeWhatsApp(
  input: WelcomeWhatsAppInput,
): Promise<WhatsAppSendResult> {
  const phone = normalizeWhatsAppPhone(input.whatsapp);
  if (phone.length < 12) {
    return { sent: false, skipped: true, reason: "WhatsApp inválido ou não informado." };
  }
  if (!isEvolutionConfigured()) {
    return {
      sent: false,
      skipped: true,
      reason: "Evolution API não configurada (EVOLUTION_API_URL / KEY / INSTANCE).",
    };
  }

  const text = buildWelcomeWhatsAppText({
    usuario: input.usuario,
    senha: input.senha,
    loginUrl: input.loginUrl,
    communityLink: input.communityLink,
  });

  try {
    const result = await evolutionSendText({ phone, text });
    if (!result.ok) {
      return {
        sent: false,
        skipped: false,
        error: result.error ?? "Falha ao enviar WhatsApp de boas-vindas.",
      };
    }
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      error: error instanceof Error ? error.message : "Falha ao enviar WhatsApp de boas-vindas.",
    };
  }
}
