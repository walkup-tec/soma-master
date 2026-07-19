import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig, type SessionData } from "@/lib/auth/session-config";
import { createWabaAlternativaCampaign } from "@/lib/waba/waba-alternativa-campaign.adapter";
import type { FunnelDisparoConfig } from "@/lib/marketing/funnel.types";

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
    selectedInstanceNames: Array.isArray(body.selectedInstanceNames)
      ? body.selectedInstanceNames.map((n) => String(n || "").trim()).filter(Boolean)
      : [],
    wabaCampaignId: body.wabaCampaignId ?? null,
    lastGenerateError: null,
  };
}

export const createWabaAlternativaCampaignFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => parseDisparoInput(data))
  .handler(async ({ data }) => {
    try {
      const session = await getSession(sessionConfig);
      const user = session.data as SessionData | undefined;
      if (!user?.userId) {
        return {
          ok: false as const,
          error: "Faça login novamente para gerar a campanha.",
        };
      }
      if (!sessionCanAccessMenu(user, "marketing")) {
        return {
          ok: false as const,
          error: "Sem permissão para Funil e WhatsApp.",
        };
      }
      return await createWabaAlternativaCampaign(data);
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error ? error.message : "Falha ao gerar campanha no WABA.",
      };
    }
  });
