import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig, type SessionData } from "@/lib/auth/session-config";
import {
  addSomaAlternativaCampaignInstances,
  createWabaAlternativaCampaign,
  deleteSomaAlternativaCampaign,
  listSomaAlternativaCampaigns,
  renameSomaAlternativaCampaign,
  setSomaAlternativaCampaignActive,
} from "@/lib/waba/waba-alternativa-campaign.adapter";
import type { FunnelDisparoConfig } from "@/lib/marketing/funnel.types";
import { normalizeFunnelWorkingDays } from "@/lib/marketing/funnel.types";

function parseDisparoInput(data: unknown): FunnelDisparoConfig {
  if (!data || typeof data !== "object") throw new Error("Configuração de disparo inválida.");
  const body = data as Partial<FunnelDisparoConfig>;
  if (!String(body.campaignName || "").trim()) throw new Error("Nome da campanha obrigatório.");
  return {
    campaignName: String(body.campaignName || "").trim(),
    plannedSendCount: Math.max(0, Math.floor(Number(body.plannedSendCount) || 0)),
    messageMode: "ai",
    aiBriefing: String(body.aiBriefing || ""),
    aiTone: String(body.aiTone || "consultivo"),
    aiCta: String(body.aiCta || "Responda no link abaixo"),
    aiAudience: String(body.aiAudience || "CORBAN"),
    linkDestinationMode: body.linkDestinationMode === "url" ? "url" : "whatsapp",
    whatsappTargetNumber: String(body.whatsappTargetNumber || ""),
    responseUrl: String(body.responseUrl || ""),
    startHour: Math.max(0, Math.min(23, Math.floor(Number(body.startHour) || 8))),
    endHour: Math.max(1, Math.min(24, Math.floor(Number(body.endHour) || 22))),
    workingDays: normalizeFunnelWorkingDays(body.workingDays),
    selectedInstanceNames: Array.isArray(body.selectedInstanceNames)
      ? body.selectedInstanceNames.map((n) => String(n || "").trim()).filter(Boolean)
      : [],
    wabaCampaignId: body.wabaCampaignId ?? null,
    lastGenerateError: null,
  };
}

async function requireMarketingSession() {
  const session = await getSession(sessionConfig);
  const user = session.data as SessionData | undefined;
  if (!user?.userId) {
    return { ok: false as const, error: "Faça login novamente." };
  }
  if (!sessionCanAccessMenu(user, "marketing")) {
    return { ok: false as const, error: "Sem permissão para Funil e WhatsApp." };
  }
  return { ok: true as const, user };
}

export const createWabaAlternativaCampaignFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => parseDisparoInput(data))
  .handler(async ({ data }) => {
    try {
      const auth = await requireMarketingSession();
      if (!auth.ok) return { ok: false as const, error: auth.error };
      return await createWabaAlternativaCampaign(data);
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error ? error.message : "Falha ao gerar campanha no WABA.",
      };
    }
  });

export const listSomaAlternativaCampaignsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const auth = await requireMarketingSession();
    if (!auth.ok) return { ok: false as const, items: [], error: auth.error };
    return listSomaAlternativaCampaigns();
  },
);

export const setSomaAlternativaCampaignActiveFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = (data && typeof data === "object" ? data : {}) as {
      id?: string;
      ativa?: boolean;
    };
    const id = String(body.id || "").trim();
    if (!id) throw new Error("Campanha inválida.");
    return { id, ativa: body.ativa === true };
  })
  .handler(async ({ data }) => {
    const auth = await requireMarketingSession();
    if (!auth.ok) return { ok: false as const, error: auth.error };
    return setSomaAlternativaCampaignActive(data.id, data.ativa);
  });

export const addSomaAlternativaCampaignInstancesFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const id = String((data as { id?: string })?.id || "").trim();
    if (!id) throw new Error("Campanha inválida.");
    return { id };
  })
  .handler(async ({ data }) => {
    const auth = await requireMarketingSession();
    if (!auth.ok) return { ok: false as const, error: auth.error };
    return addSomaAlternativaCampaignInstances(data.id);
  });

export const renameSomaAlternativaCampaignFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = (data && typeof data === "object" ? data : {}) as {
      id?: string;
      name?: string;
    };
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    if (!id) throw new Error("Campanha inválida.");
    if (!name) throw new Error("Nome obrigatório.");
    return { id, name };
  })
  .handler(async ({ data }) => {
    const auth = await requireMarketingSession();
    if (!auth.ok) return { ok: false as const, error: auth.error };
    return renameSomaAlternativaCampaign(data.id, data.name);
  });

export const deleteSomaAlternativaCampaignFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const id = String((data as { id?: string })?.id || "").trim();
    if (!id) throw new Error("Campanha inválida.");
    return { id };
  })
  .handler(async ({ data }) => {
    const auth = await requireMarketingSession();
    if (!auth.ok) return { ok: false as const, error: auth.error };
    return deleteSomaAlternativaCampaign(data.id);
  });
