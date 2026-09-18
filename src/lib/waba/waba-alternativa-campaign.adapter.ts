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

function envError(): CreateAlternativaCampaignResult | null {
  if (!resolveWabaBaseUrl()) {
    return { ok: false, error: "WABA_API_BASE_URL não configurada no Soma." };
  }
  if (!resolveIntegrationKey()) {
    return { ok: false, error: "SOMA_WABA_INTEGRATION_KEY não configurada no Soma." };
  }
  return null;
}

async function somaFetch<T extends { ok?: boolean; error?: string }>(
  path: string,
  init: RequestInit,
  timeoutMs = 60_000,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const base = resolveWabaBaseUrl();
  const key = resolveIntegrationKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Soma-Waba-Key": key,
        ...(init.headers || {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const contentType = String(response.headers.get("content-type") || "");
    if (!contentType.includes("application/json")) {
      return {
        ok: false,
        status: response.status,
        data: null,
        error:
          response.status === 401 || response.status === 403
            ? "WABA recusou a chave de integração (SOMA_WABA_INTEGRATION_KEY)."
            : `WABA respondeu ${response.status} (esperado JSON). Verifique WABA_API_BASE_URL.`,
      };
    }
    const data = (await response.json().catch(() => null)) as T | null;
    return { ok: response.ok && data?.ok !== false, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error:
        error instanceof Error && error.name === "AbortError"
          ? "Timeout ao falar com o WABA."
          : error instanceof Error
            ? error.message
            : "Falha de rede ao falar com o WABA.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Cria campanha no WABA a partir do módulo Disparo do Funil.
 * Envia só o que o motor precisa — delays são calculados no WABA.
 */
export async function createWabaAlternativaCampaign(
  config: FunnelDisparoConfig,
): Promise<CreateAlternativaCampaignResult> {
  const env = envError();
  if (env) return env;

  const result = await somaFetch<{
    ok?: boolean;
    campaign?: { id?: string };
    id?: string;
    message?: string;
    error?: string;
  }>("/integrations/soma/alternativa-campaigns", {
    method: "POST",
    body: JSON.stringify({
      name: config.campaignName,
      plannedSendCount: config.plannedSendCount,
      selectedDisparadorInstances: config.selectedInstanceNames,
      startHour: config.startHour,
      endHour: config.endHour,
      workingDays: config.workingDays,
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
  });

  if (!result.ok || !result.data?.ok) {
    const rawError = result.data?.error || result.error || `WABA respondeu ${result.status}.`;
    const error =
      rawError.includes("Sessão expirada") || rawError.includes("não autenticado")
        ? "WABA em produção desatualizado: faça Redeploy do serviço waba_disparador no Easypanel (integração Soma Alternativa)."
        : rawError;
    return { ok: false, error };
  }
  return {
    ok: true,
    campaignId: result.data.campaign?.id || result.data.id,
    message: result.data.message,
  };
}
