import type { FunnelDisparoConfig } from "@/lib/marketing/funnel.types";

export type CreateAlternativaCampaignResult = {
  ok: boolean;
  campaignId?: string;
  message?: string;
  error?: string;
};

function resolveWabaBaseUrl(): string {
  return String(process.env.WABA_API_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
}

function resolveIntegrationKey(): string {
  return String(process.env.SOMA_WABA_INTEGRATION_KEY || "").trim();
}

/**
 * Cria campanha API Alternativa no WABA (owner SOMA_WABA_OWNER_EMAIL / mozart).
 * Envia só o que o motor Alternativa precisa — delays são calculados no WABA.
 */
export async function createWabaAlternativaCampaign(
  config: FunnelDisparoConfig,
): Promise<CreateAlternativaCampaignResult> {
  const base = resolveWabaBaseUrl();
  const key = resolveIntegrationKey();
  if (!base) {
    return { ok: false, error: "WABA_API_BASE_URL não configurada no Soma." };
  }
  if (!key) {
    return { ok: false, error: "SOMA_WABA_INTEGRATION_KEY não configurada no Soma." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(`${base}/integrations/soma/alternativa-campaigns`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Soma-Waba-Key": key,
      },
      body: JSON.stringify({
        name: config.campaignName,
        plannedSendCount: config.plannedSendCount,
        selectedDisparadorInstances: config.selectedInstanceNames,
        startHour: config.startHour,
        endHour: config.endHour,
        messageMode: "ai",
        aiBriefing: config.aiBriefing,
        aiTone: config.aiTone,
        aiCta: config.aiCta,
        aiAudience: config.aiAudience,
        linkDestinationMode: config.linkDestinationMode,
        whatsappTargetNumber: config.whatsappTargetNumber,
        responseUrl: config.responseUrl,
        shortenerProvider: "waba",
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const contentType = String(response.headers.get("content-type") || "");
    if (!contentType.includes("application/json")) {
      return {
        ok: false,
        error:
          response.status === 401 || response.status === 403
            ? "WABA recusou a chave de integração (SOMA_WABA_INTEGRATION_KEY)."
            : `WABA respondeu ${response.status} (esperado JSON). Verifique WABA_API_BASE_URL.`,
      };
    }

    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      campaign?: { id?: string };
      id?: string;
      message?: string;
      error?: string;
    } | null;

    if (!response.ok || !data?.ok) {
      const rawError = data?.error || `WABA respondeu ${response.status}.`;
      const error =
        rawError.includes("Sessão expirada") || rawError.includes("não autenticado")
          ? "WABA em produção desatualizado: faça Redeploy do serviço waba_disparador no Easypanel (integração Soma Alternativa)."
          : rawError;
      return { ok: false, error };
    }
    return {
      ok: true,
      campaignId: data.campaign?.id || data.id,
      message: data.message,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.name === "AbortError"
          ? "Timeout ao criar campanha no WABA."
          : error instanceof Error
            ? error.message
            : "Falha de rede ao criar campanha no WABA.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
