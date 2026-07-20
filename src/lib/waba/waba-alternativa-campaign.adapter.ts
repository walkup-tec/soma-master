import type { FunnelDisparoConfig } from "@/lib/marketing/funnel.types";

export type CreateAlternativaCampaignResult = {
  ok: boolean;
  campaignId?: string;
  message?: string;
  error?: string;
};

export type SomaCampaignInstanceTag = {
  instanceName: string;
  connected: boolean;
};

export type SomaCampaignInstanceHealth = {
  selectedCount: number;
  connectedCount: number;
  disconnectedCount: number;
  disconnectedPercent: number;
  shouldPauseByDisconnectedRatio: boolean;
  minConnectedRequired: number;
  needsMoreInstancesForMinimum: boolean;
  missingConnectedForMinimum: number;
};

export type SomaCampaignRuntimeStage = {
  phase: "draft" | "sending" | "waiting_interval" | "outside_window" | "paused" | "finished";
  label: string;
  detail: string;
  fillPercent: number;
};

export type SomaAlternativaCampaign = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  totalNumbers: number;
  sentCount: number;
  processedCount: number;
  progressPercent: number;
  nextAllowedAt: string | null;
  disparadorInstances: SomaCampaignInstanceTag[];
  instanceHealth: SomaCampaignInstanceHealth;
  runtimeStage: SomaCampaignRuntimeStage;
  ownerEmail?: string;
};

export type SomaActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  status?: string;
  code?: string;
  instanceHealth?: SomaCampaignInstanceHealth;
  stillNeedsMore?: boolean;
};

function resolveWabaBaseUrl(): string {
  return String(process.env.WABA_API_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
}

function resolveIntegrationKey(): string {
  return String(process.env.SOMA_WABA_INTEGRATION_KEY || "").trim();
}

function envError(): SomaActionResult | null {
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
 * Cria campanha API Alternativa no WABA (owner SOMA_WABA_OWNER_EMAIL / mozart).
 * Envia só o que o motor Alternativa precisa — delays são calculados no WABA.
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

export async function listSomaAlternativaCampaigns(): Promise<{
  ok: boolean;
  ownerEmail?: string;
  items: SomaAlternativaCampaign[];
  error?: string;
}> {
  const env = envError();
  if (env) return { ok: false, items: [], error: env.error };

  const result = await somaFetch<{
    ok?: boolean;
    ownerEmail?: string;
    items?: SomaAlternativaCampaign[];
    error?: string;
  }>("/integrations/soma/alternativa-campaigns", { method: "GET" }, 30_000);

  if (!result.ok || !result.data?.ok) {
    return {
      ok: false,
      items: [],
      error: result.data?.error || result.error || `WABA respondeu ${result.status}.`,
    };
  }
  return {
    ok: true,
    ownerEmail: result.data.ownerEmail,
    items: Array.isArray(result.data.items) ? result.data.items : [],
  };
}

export async function setSomaAlternativaCampaignActive(
  id: string,
  ativa: boolean,
): Promise<SomaActionResult> {
  const env = envError();
  if (env) return env;
  const result = await somaFetch<{
    ok?: boolean;
    message?: string;
    error?: string;
    status?: string;
    code?: string;
    instanceHealth?: SomaCampaignInstanceHealth;
  }>(`/integrations/soma/alternativa-campaigns/${encodeURIComponent(id)}/estado`, {
    method: "POST",
    body: JSON.stringify({ ativa }),
  });
  return {
    ok: Boolean(result.ok && result.data?.ok),
    message: result.data?.message,
    error: result.data?.error || result.error,
    status: result.data?.status,
    code: result.data?.code,
    instanceHealth: result.data?.instanceHealth,
  };
}

export async function addSomaAlternativaCampaignInstances(
  id: string,
): Promise<SomaActionResult> {
  const env = envError();
  if (env) return env;
  const result = await somaFetch<{
    ok?: boolean;
    message?: string;
    error?: string;
    code?: string;
    stillNeedsMore?: boolean;
    instanceHealth?: SomaCampaignInstanceHealth;
  }>(`/integrations/soma/alternativa-campaigns/${encodeURIComponent(id)}/instancias`, {
    method: "POST",
    body: JSON.stringify({ auto: true }),
  });
  return {
    ok: Boolean(result.ok && result.data?.ok),
    message: result.data?.message,
    error: result.data?.error || result.error,
    code: result.data?.code,
    stillNeedsMore: result.data?.stillNeedsMore,
    instanceHealth: result.data?.instanceHealth,
  };
}

export async function renameSomaAlternativaCampaign(
  id: string,
  name: string,
): Promise<SomaActionResult> {
  const env = envError();
  if (env) return env;
  const result = await somaFetch<{
    ok?: boolean;
    message?: string;
    error?: string;
  }>(`/integrations/soma/alternativa-campaigns/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return {
    ok: Boolean(result.ok && result.data?.ok),
    message: result.data?.message,
    error: result.data?.error || result.error,
  };
}

export async function deleteSomaAlternativaCampaign(id: string): Promise<SomaActionResult> {
  const env = envError();
  if (env) return env;
  const result = await somaFetch<{
    ok?: boolean;
    message?: string;
    error?: string;
  }>(`/integrations/soma/alternativa-campaigns/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return {
    ok: Boolean(result.ok && result.data?.ok),
    message: result.data?.message,
    error: result.data?.error || result.error,
  };
}
