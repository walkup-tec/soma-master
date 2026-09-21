import { appendMessage, getOrCreateConversationByPhone } from "@/lib/chat/chat.repository";
import {
  evolutionFetchAllInstances,
  evolutionFindMessages,
  evolutionFindRecentChats,
  getDefaultSomaEvolutionInstance,
  isEvolutionConfigured,
  registerOperableEvolutionInstance,
} from "@/lib/chat/evolution.adapter";
import { extractInboundFromEvolution } from "@/lib/chat/evolution-inbound";
import { instanceIsMetaCloud } from "@/lib/chat/meta-cloud/meta-cloud.adapter";
import { phonesMatch } from "@/lib/chat/phone";
import { listWhatsappInstances } from "@/lib/chat/whatsapp-instances.repository";

const PULL_COOLDOWN_MS = 20_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_CHAT_LIMIT = 12;

let lastPullAt = 0;
let inFlight: Promise<number> | null = null;

function chatRemoteJid(chat: Record<string, unknown>): string {
  const last =
    chat.lastMessage && typeof chat.lastMessage === "object"
      ? (chat.lastMessage as Record<string, unknown>)
      : null;
  const lastKey =
    last?.key && typeof last.key === "object" ? (last.key as Record<string, unknown>) : null;
  return String(
    chat.id ||
      chat.remoteJid ||
      chat.jid ||
      lastKey?.remoteJidAlt ||
      lastKey?.remoteJid ||
      last?.remoteJid ||
      "",
  ).trim();
}

function chatSortMs(chat: Record<string, unknown>): number {
  const updated = Date.parse(String(chat.updatedAt || chat.conversationTimestamp || ""));
  if (Number.isFinite(updated) && updated > 0) return updated;
  const last =
    chat.lastMessage && typeof chat.lastMessage === "object"
      ? (chat.lastMessage as Record<string, unknown>)
      : null;
  const ts = Number(last?.messageTimestamp || last?.timestamp || 0);
  if (!Number.isFinite(ts) || ts <= 0) return 0;
  return ts > 1_000_000_000_000 ? ts : ts * 1000;
}

async function importChatPayload(payload: unknown, instanceName: string): Promise<number> {
  const messages = extractInboundFromEvolution(payload);
  let imported = 0;
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const msg of messages) {
    if (msg.timestampMs && msg.timestampMs < cutoff) continue;
    const body =
      msg.text ||
      (msg.mediaType === "document"
        ? "Documento recebido no WhatsApp."
        : msg.mediaType === "image"
          ? "Imagem recebida no WhatsApp."
          : "");
    if (!body) continue;
    const conversation = await getOrCreateConversationByPhone({
      phone: msg.phone,
      contactName: msg.fromMe ? null : (msg.pushName ?? null),
      instanceName,
    });
    if (
      !msg.messageId &&
      conversation.lastMessagePreview &&
      conversation.lastMessagePreview.replace(/^[📷📄]\s*/, "") === body
    ) {
      continue;
    }
    try {
      await appendMessage({
        conversationId: conversation.id,
        direction: msg.fromMe ? "outbound" : "inbound",
        body,
        senderType: msg.fromMe ? "agent" : "contact",
        senderName: msg.fromMe ? "WhatsApp" : (msg.pushName ?? conversation.contactName),
        waMessageId: msg.messageId ?? null,
        bumpUnread: !msg.fromMe,
      });
      imported += 1;
    } catch (error) {
      console.warn("[chat] falha ao importar inbound Evolution", msg.phone, error);
    }
  }
  return imported;
}

/** Canais Evolution cadastrados no ChatBot, mais qualquer instância EVO com o mesmo número. */
async function resolveIntegratedInstanceNames(): Promise<string[]> {
  const channels = (await listWhatsappInstances()).filter((item) => !instanceIsMetaCloud(item));
  const names = new Set<string>();
  for (const channel of channels) {
    registerOperableEvolutionInstance(channel.instanceName);
    names.add(channel.instanceName);
  }

  if (isEvolutionConfigured() && channels.some((channel) => channel.phone)) {
    const live = await evolutionFetchAllInstances();
    if (live.ok) {
      for (const channel of channels) {
        if (!channel.phone) continue;
        for (const item of live.instances) {
          if (!item.phone || !phonesMatch(item.phone, channel.phone)) continue;
          registerOperableEvolutionInstance(item.instanceName);
          names.add(item.instanceName);
        }
      }
    }
  }

  if (names.size === 0) names.add(getDefaultSomaEvolutionInstance());
  return [...names];
}

async function importRecentChats(instanceName: string): Promise<number> {
  const found = await evolutionFindRecentChats(instanceName, 50);
  if (!found.ok) {
    console.warn("[chat] findChats falhou ao recuperar inbound", instanceName, found.error);
    return 0;
  }
  let imported = await importChatPayload({ chats: found.chats }, instanceName);
  const ranked = [...found.chats].sort((a, b) => chatSortMs(b) - chatSortMs(a));
  const unique: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const chat of ranked) {
    const jid = chatRemoteJid(chat);
    if (!jid || seen.has(jid)) continue;
    seen.add(jid);
    unique.push(chat);
    if (unique.length >= RECENT_CHAT_LIMIT) break;
  }
  for (const chat of unique) {
    const jid = chatRemoteJid(chat);
    const messages = await evolutionFindMessages(instanceName, jid, 50);
    if (!messages.ok) continue;
    imported += await importChatPayload({ messages: messages.messages, chat }, instanceName);
  }
  return imported;
}

/**
 * Busca no Evolution as mensagens dos números integrados no ChatBot.
 * O nome técnico da instância não importa — vale o canal cadastrado e o telefone conectado.
 */
export async function pullRecentEvolutionInbound(): Promise<number> {
  if (!isEvolutionConfigured()) return 0;
  const now = Date.now();
  if (now - lastPullAt < PULL_COOLDOWN_MS) return 0;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    lastPullAt = Date.now();
    let imported = 0;
    try {
      const names = await resolveIntegratedInstanceNames();
      for (const instanceName of names) {
        imported += await importRecentChats(instanceName);
      }
    } catch (error) {
      console.error("[chat] pullRecentEvolutionInbound falhou", error);
    } finally {
      inFlight = null;
    }
    return imported;
  })();

  return inFlight;
}
