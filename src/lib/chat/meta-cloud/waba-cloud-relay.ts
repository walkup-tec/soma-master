/**
 * Registra phone_number_id no WABA para o webhook Meta (já autorizado no App)
 * reenviar inbound do ChatBot Soma.
 */

function resolveWabaBaseUrl(): string {
  return String(process.env.WABA_API_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
}

function resolveIntegrationKey(): string {
  return String(process.env.SOMA_WABA_INTEGRATION_KEY || "").trim();
}

function resolveSomaCloudWebhookUrl(): string | null {
  const explicit = String(process.env.SOMA_CHAT_CLOUD_WEBHOOK_URL || "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  const base = String(
    process.env.CHAT_PUBLIC_BASE_URL || process.env.PUBLIC_APP_URL || process.env.APP_URL || "",
  )
    .trim()
    .replace(/\/+$/, "");
  if (!base || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base)) return null;
  return `${base}/api/chat/whatsapp-cloud-webhook`;
}

async function postWabaRelay(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const base = resolveWabaBaseUrl();
  const key = resolveIntegrationKey();
  if (!base) return { ok: false, error: "WABA_API_BASE_URL não configurada." };
  if (!key) return { ok: false, error: "SOMA_WABA_INTEGRATION_KEY não configurada." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Soma-Waba-Key": key,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || data?.ok === false) {
      return { ok: false, error: data?.error || `WABA respondeu ${response.status}.` };
    }
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Timeout ao registrar o número no WABA."
        : error instanceof Error
          ? error.message
          : "Falha de rede ao falar com o WABA.";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function registerSomaCloudNumberOnWaba(input: {
  phoneNumberId: string;
  wabaId?: string | null;
  displayPhone?: string | null;
  label?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const phoneNumberId = String(input.phoneNumberId || "").trim();
  if (!phoneNumberId) return { ok: false, error: "phone_number_id ausente." };
  return postWabaRelay("/integrations/soma/chatbot-cloud-numbers", {
    action: "register",
    phoneNumberId,
    wabaId: input.wabaId || undefined,
    displayPhone: input.displayPhone || undefined,
    label: input.label || undefined,
    webhookUrl: resolveSomaCloudWebhookUrl(),
  });
}

export async function unregisterSomaCloudNumberOnWaba(phoneNumberId: string): Promise<{ ok: boolean; error?: string }> {
  const id = String(phoneNumberId || "").trim();
  if (!id) return { ok: true };
  return postWabaRelay("/integrations/soma/chatbot-cloud-numbers", {
    action: "unregister",
    phoneNumberId: id,
  });
}
