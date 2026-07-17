import {
  assertSomaOwnedInstance,
  evolutionSendImage,
  evolutionSendText,
  getEvolutionPublicConfig,
  isEvolutionConfigured,
} from "@/lib/chat/evolution.adapter";
import {
  resolveDefaultPushCommunityEvoInstance,
  resolvePushCommunityAnnouncementJidEnv,
  resolvePushCommunityInviteLink,
} from "@/lib/push/push.constants";
import { readPushMediaBase64 } from "@/lib/push/push-media.service";
import { readPushConfig, writePushConfig } from "@/lib/push/push.repository";
import type { SomaPushConfig, SomaPushImageAttachment } from "@/lib/push/push.types";

function parseGroupsPayload(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.response)) return record.response as Array<Record<string, unknown>>;
    if (Array.isArray(record.data)) return record.data as Array<Record<string, unknown>>;
    if (Array.isArray(record.groups)) return record.groups as Array<Record<string, unknown>>;
  }
  return [];
}

function isTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function pickAnnouncementGroupJid(groups: Array<Record<string, unknown>>): string {
  for (const group of groups) {
    if (
      isTruthyFlag(group.isCommunityAnnounce) ||
      isTruthyFlag(group.isCommunityAnnouncement) ||
      isTruthyFlag(group.announce) ||
      isTruthyFlag(group.announcement)
    ) {
      const jid = String(group.id || group.jid || group.groupJid || "").trim();
      if (jid.includes("@g.us")) return jid;
    }
  }
  for (const group of groups) {
    const jid = String(group.id || group.jid || group.groupJid || "").trim();
    const subject = String(group.subject || group.name || "").toLowerCase();
    if (jid.includes("@g.us") && (subject.includes("anúncio") || subject.includes("anuncio"))) {
      return jid;
    }
  }
  return "";
}

async function evolutionFetchGroups(instanceName: string): Promise<Array<Record<string, unknown>>> {
  const base = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, "") ?? "";
  const apiKey = process.env.EVOLUTION_API_KEY?.trim() ?? "";
  if (!base || !apiKey) {
    throw new Error("Evolution API não configurada.");
  }
  assertSomaOwnedInstance(instanceName);
  const response = await fetch(
    `${base}/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=false`,
    {
      method: "GET",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
    },
  );
  const rawText = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    json = null;
  }
  if (!response.ok) {
    throw new Error(
      `Não foi possível listar grupos da comunidade (${response.status}): ${rawText.slice(0, 220)}`,
    );
  }
  return parseGroupsPayload(json);
}

async function resolveAnnouncementGroupJid(instanceName: string): Promise<string> {
  const envJid = resolvePushCommunityAnnouncementJidEnv();
  if (envJid) return envJid;

  const config = readPushConfig();
  if (config.communityAnnouncementGroupJid.includes("@g.us")) {
    return config.communityAnnouncementGroupJid;
  }

  const groups = await evolutionFetchGroups(instanceName);
  const jid = pickAnnouncementGroupJid(groups);
  if (!jid) {
    throw new Error(
      "Grupo de Anúncios da comunidade não encontrado. Configure SOMA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID no Easypanel.",
    );
  }
  writePushConfig({
    ...config,
    communityEvoInstance: instanceName,
    communityAnnouncementGroupJid: jid,
  });
  return jid;
}

function buildCommunityText(title: string, body: string): string {
  const cleanTitle = String(title || "").trim();
  const cleanBody = String(body || "").trim();
  if (cleanTitle && cleanBody) return `*${cleanTitle}*\n\n${cleanBody}`;
  if (cleanTitle) return `*${cleanTitle}*`;
  return cleanBody;
}

/** Envia texto/imagem para o grupo de anúncios da comunidade (JID @g.us). */
export async function sendPushToWhatsAppCommunity(
  title: string,
  text: string,
  image: SomaPushImageAttachment | null,
): Promise<{ ok: boolean; detail: string; groupJid?: string }> {
  if (!isEvolutionConfigured()) {
    return { ok: false, detail: "Evolution API não configurada." };
  }

  const config = readPushConfig();
  const instanceName =
    String(config.communityEvoInstance || "").trim() || resolveDefaultPushCommunityEvoInstance();
  assertSomaOwnedInstance(instanceName);

  try {
    const groupJid = await resolveAnnouncementGroupJid(instanceName);
    const message = buildCommunityText(title, text);

    if (image?.id) {
      const media = readPushMediaBase64(image.id);
      if (!media) {
        return { ok: false, detail: "Imagem do push não encontrada no servidor.", groupJid };
      }
      const dataUrl = `data:${media.mimeType};base64,${media.base64}`;
      const sendImage = await evolutionSendImage({
        phone: groupJid,
        dataUrl,
        mimeType: media.mimeType,
        fileName: image.fileName || "comunicado.jpg",
        caption: message,
      });
      if (!sendImage.ok) {
        return {
          ok: false,
          detail: sendImage.error || "Falha ao enviar imagem para a comunidade.",
          groupJid,
        };
      }
      return { ok: true, detail: "Imagem enviada à comunidade WhatsApp.", groupJid };
    }

    if (!message) {
      return { ok: false, detail: "Informe título ou texto para a comunidade.", groupJid };
    }

    const sendText = await evolutionSendText({ phone: groupJid, text: message });
    if (!sendText.ok) {
      return {
        ok: false,
        detail: sendText.error || "Falha ao enviar texto para a comunidade.",
        groupJid,
      };
    }
    return { ok: true, detail: "Texto enviado à comunidade WhatsApp.", groupJid };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Falha ao publicar na comunidade.",
    };
  }
}

export function getPushCommunityConfig(): SomaPushConfig {
  const config = readPushConfig();
  return {
    ...config,
    communityInviteLink: config.communityInviteLink || resolvePushCommunityInviteLink(),
    communityEvoInstance: config.communityEvoInstance || resolveDefaultPushCommunityEvoInstance(),
  };
}

export async function loadPushCommunityConfigForAdmin(): Promise<{
  config: SomaPushConfig;
  evolution: ReturnType<typeof getEvolutionPublicConfig>;
}> {
  return {
    config: getPushCommunityConfig(),
    evolution: getEvolutionPublicConfig(),
  };
}

export function updatePushCommunityConfig(input: {
  communityAnnouncementGroupJid?: string;
  communityEvoInstance?: string;
  communityInviteLink?: string;
}): SomaPushConfig {
  const current = readPushConfig();
  const nextInstance =
    String(input.communityEvoInstance ?? current.communityEvoInstance).trim() ||
    resolveDefaultPushCommunityEvoInstance();
  assertSomaOwnedInstance(nextInstance);

  const nextLink =
    String(input.communityInviteLink ?? current.communityInviteLink).trim() ||
    resolvePushCommunityInviteLink();
  if (!nextLink.startsWith("https://chat.whatsapp.com/")) {
    throw new Error("Informe um link válido de comunidade WhatsApp.");
  }

  return writePushConfig({
    communityInviteLink: nextLink,
    communityAnnouncementGroupJid: String(
      input.communityAnnouncementGroupJid ?? current.communityAnnouncementGroupJid,
    ).trim(),
    communityEvoInstance: nextInstance,
    updatedAt: new Date().toISOString(),
  });
}
