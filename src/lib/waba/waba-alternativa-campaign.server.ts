import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig } from "@/lib/auth/session-config";
import { createWabaAlternativaCampaign } from "@/lib/waba/waba-alternativa-campaign.adapter";
import type { FunnelDisparoConfig } from "@/lib/marketing/funnel.types";

async function requireMarketingAccess() {
  const session = await getSession(sessionConfig);
  const user = session.data;
  if (!user?.userId) throw new Error("Não autenticado.");
  if (!sessionCanAccessMenu(user, "marketing")) {
    throw new Error("Sem permissão para Funil e WhatsApp.");
  }
  return user;
}

export const createWabaAlternativaCampaignFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = data as FunnelDisparoConfig;
    if (!body || typeof body !== "object") throw new Error("Configuração de disparo inválida.");
    if (!String(body.campaignName || "").trim()) throw new Error("Nome da campanha obrigatório.");
    return body;
  })
  .handler(async ({ data }) => {
    await requireMarketingAccess();
    return createWabaAlternativaCampaign(data);
  });
