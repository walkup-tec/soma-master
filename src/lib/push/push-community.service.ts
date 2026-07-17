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

function extractInviteCode(link: string): string {
  const raw = String(link || "").trim();
  const match = raw.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i);
  return match?.[1]?.trim() || "";
}

function pickJidFromUnknown(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const record = raw as Record<string, unknown>;
  const nested =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : record.response && typeof record.response === "object"
        ? (record.response as Record<string, unknown>)
        : record;
  const candidates = [nested.id, nested.jid, nested.groupJid, nested.groupId, record.id, record.jid];
  for (const value of candidates) {
    const jid = String(value || "").trim();
    if (jid.includes("@g.us")) return jid;
  }
  return "";
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
    if (
      jid.includes("@g.us") &&
      (subject.includes("anúncio") ||
        subject.includes("anuncio") ||
        subject.includes("avisos") ||
        subject.includes("announcement"))
    ) {
      return jid;
    }
  }
  return "";
}

async function evolutionGetJson(
  path: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; json: unknown; rawText: string }> {
  const base = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, "") ?? "";
  const apiKey = process.env.EVOLUTION_API_KEY?.trim() ?? "";
  if (!base || !apiKey) {
    throw new Error("Evolution API não configurada.");
  }
  const response = await fetch(`${base}${path}`, {
    method: "GET",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const rawText = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json, rawText };
}

async function evolutionFetchGroups(instanceName: string): Promise<Array<Record<string, unknown>>> {
  assertSomaOwnedInstance(instanceName);
  const result = await evolutionGetJson(
    `/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=false`,
    20_000,
  );
  if (!result.ok) {
    throw new Error(
      `Não foi possível listar grupos da comunidade (${result.status}): ${result.rawText.slice(0, 220)}`,
    );
  }
  return parseGroupsPayload(result.json);
}

/** Resolve JID via código do convite (mais rápido que listar todos os grupos). */
async function evolutionResolveJidFromInvite(
  instanceName: string,
  inviteLink: string,
): Promise<string> {
  const inviteCode = extractInviteCode(inviteLink);
  if (!inviteCode) return "";
  assertSomaOwnedInstance(instanceName);
  try {
    const result = await evolutionGetJson(
      `/group/inviteInfo/${encodeURIComponent(instanceName)}?inviteCode=${encodeURIComponent(inviteCode)}`,
      12_000,
    );
    if (!result.ok) return "";
    return pickJidFromUnknown(result.json);
  } catch {
    return "";
  }
}

async function discoverAnnouncementGroupJid(instanceName: string): Promise<string> {
  try {
    const groups = await evolutionFetchGroups(instanceName);
    const fromGroups = pickAnnouncementGroupJid(groups);
    if (fromGroups) return fromGroups;
  } catch {
    /* tenta invite abaixo */
  }

  const config = readPushConfig();
  const inviteLink = config.communityInviteLink || resolvePushCommunityInviteLink();
  const fromInvite = await evolutionResolveJidFromInvite(instanceName, inviteLink);
  return fromInvite;
}

async function resolveAnnouncementGroupJid(
  instanceName: string,
  options?: { forceRediscover?: boolean },
): Promise<string> {
  const envJid = resolvePushCommunityAnnouncementJidEnv();
  if (envJid && !options?.forceRediscover) return envJid;

  const config = readPushConfig();
  if (!options?.forceRediscover && config.communityAnnouncementGroupJid.includes("@g.us")) {
    return config.communityAnnouncementGroupJid;
  }

  const jid = await discoverAnnouncementGroupJid(instanceName);
  if (!jid) {
    throw new Error(
      "Grupo de Anúncios da comunidade não encontrado. Defina SOMA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID no Easypanel (JID …@g.us).",
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

async function sendCommunityTextOnce(
  instanceName: string,
  groupJid: string,
  message: string,
): Promise<{ ok: boolean; detail: string; groupJid: string }> {
  const sendText = await evolutionSendText({
    phone: groupJid,
    text: message,
    instanceName,
  });
  if (!sendText.ok) {
    return {
      ok: false,
      detail: sendText.error || "Falha ao enviar texto para a comunidade.",
      groupJid,
    };
  }
  return { ok: true, detail: "Texto enviado à comunidade WhatsApp.", groupJid };
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
    let groupJid = await resolveAnnouncementGroupJid(instanceName);
    const message = buildCommunityText(title, text);

    if (image?.id) {
      const media = readPushMediaBase64(image.id);
      if (!media) {
        return { ok: false, detail: "Imagem do push não encontrada no servidor.", groupJid };
      }
      const dataUrl = `data:${media.mimeType};base64,${media.base64}`;
      let sendImage = await evolutionSendImage({
        phone: groupJid,
        dataUrl,
        mimeType: media.mimeType,
        fileName: image.fileName || "comunicado.jpg",
        caption: message,
        instanceName,
      });
      if (!sendImage.ok && /HTTP 400/i.test(sendImage.error || "")) {
        const rediscovered = await resolveAnnouncementGroupJid(instanceName, {
          forceRediscover: true,
        });
        if (rediscovered && rediscovered !== groupJid) {
          groupJid = rediscovered;
          sendImage = await evolutionSendImage({
            phone: groupJid,
            dataUrl,
            mimeType: media.mimeType,
            fileName: image.fileName || "comunicado.jpg",
            caption: message,
            instanceName,
          });
        }
      }
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

    let result = await sendCommunityTextOnce(instanceName, groupJid, message);
    if (!result.ok && /HTTP 400/i.test(result.detail)) {
      const rediscovered = await resolveAnnouncementGroupJid(instanceName, {
        forceRediscover: true,
      });
      if (rediscovered && rediscovered !== groupJid) {
        result = await sendCommunityTextOnce(instanceName, rediscovered, message);
      } else if (rediscovered) {
        // Mesmo JID: limpa cache inválido e tenta descoberta pura de novo
        writePushConfig({
          ...readPushConfig(),
          communityAnnouncementGroupJid: "",
        });
        const again = await resolveAnnouncementGroupJid(instanceName, { forceRediscover: true });
        if (again && again !== groupJid) {
          result = await sendCommunityTextOnce(instanceName, again, message);
        }
      }
    }
    return result;
  } catch (error) {
    const detail =
      error instanceof Error && /aborted|timeout|TimeoutError/i.test(error.message)
        ? "Timeout na Evolution ao resolver/enviar para a comunidade. Verifique se soma-crm está conectada e o JID em SOMA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID."
        : error instanceof Error
          ? error.message
          : "Falha ao publicar na comunidade.";
    return { ok: false, detail };
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
