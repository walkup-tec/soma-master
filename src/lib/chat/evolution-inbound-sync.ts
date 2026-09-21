import { appendMessage, getOrCreateConversationByPhone } from "@/lib/chat/chat.repository";
import {
  evolutionFetchAllInstances,
  evolutionFindMessages,
  evolutionFindRecentChats,
  getDefaultSomaEvolutionInstance,
  isEvolutionConfigured,
  isSomaOwnedInstance,
  registerOperableEvolutionInstance,
} from "@/lib/chat/evolution.adapter";
import { extractInboundFromEvolution } from "@/lib/chat/evolution-inbound";
import { instanceIsMetaCloud } from "@/lib/chat/meta-cloud/meta-cloud.adapter";
import { phonesMatch } from "@/lib/chat/phone";
import {
  listWhatsappInstances,
  upsertEvolutionChannel,
} from "@/lib/chat/whatsapp-instances.repository";

const PULL_COOLDOWN_MS = 45_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_CHAT_LIMIT = 4;
const ATTENDANCE_PHONES = ["555181082477", "5181082477"];
const ATTENDANCE_INSTANCE_HINTS = ["digital-corban-2477"];
const LEAD_PHONES = ["5563992358450", "556392358450", "6392358450"];

let lastPullAt = 0;
let inFlight: Promise<number> | null = null;
let attachedOnce = false;

function chatRemoteJid(chat: Record<string, unknown>): string {
  const last = chat.lastMessage && typeof chat.lastMessage === "object"
    ? (chat.lastMessage as Record<string, unknown>)
    : null;
  const lastKey = last?.key && typeof last.key === "object" ? (last.key as Record<string, unknown>) : null;
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
  const last = chat.lastMessage && typeof chat.lastMessage === "object"
    ? (chat.lastMessage as Record<string, unknown>)
    : null;
  const ts = Number(last?.messageTimestamp || last?.timestamp || 0);
  if (!Number.isFinite(ts) || ts <= 0) return 0;
  return ts > 1_000_000_000_000 ? ts : ts * 1000;
}

function isAttendancePhone(phone: string | null | undefined): boolean {
  const value = String(phone || "").replace(/\D+/g, "");
  if (!value) return false;
  return ATTENDANCE_PHONES.some((item) => phonesMatch(item, value));
}

function isPriorityLeadChat(chat: Record<string, unknown>): boolean {
  const blob = `${chatRemoteJid(chat)} ${JSON.stringify(chat.lastMessage ?? {})}`;
  return LEAD_PHONES.some((phone) => blob.includes(phone) || blob.includes(phone.slice(-10)));
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

async function ensureAttendanceEvolutionChannel(): Promise<void> {
  const listed = await listWhatsappInstances();
  for (const item of listed) {
    if (!instanceIsMetaCloud(item)) registerOperableEvolutionInstance(item.instanceName);
  }
  if (attachedOnce) return;
  attachedOnce = true;

  if (!isEvolutionConfigured()) return;
  const fetched = await evolutionFetchAllInstances();
  const instances = fetched.ok ? fetched.instances : [];
  let match =
    instances.find((item) => isAttendancePhone(item.phone)) ||
    instances.find((item) =>
      ATTENDANCE_INSTANCE_HINTS.includes(item.instanceName.trim().toLowerCase()),
    );

  if (!match) {
    match = {
      instanceName: ATTENDANCE_INSTANCE_HINTS[0]!,
      phone: "555181082477",
    };
  }

  registerOperableEvolutionInstance(match.instanceName);
  await upsertEvolutionChannel({
    instanceName: match.instanceName,
    label: "Atendimento 2477",
    phone: match.phone || "555181082477",
  }).catch((error) => {
    console.warn("[chat] não foi possível registrar o canal 2477", error);
  });
}

async function importRecentChats(instanceName: string): Promise<number> {
  const found = await evolutionFindRecentChats(instanceName, 40);
  if (!found.ok) {
    console.warn("[chat] findChats falhou ao recuperar inbound", instanceName, found.error);
    return 0;
  }
  let imported = await importChatPayload({ chats: found.chats }, instanceName);
  if (isSomaOwnedInstance(instanceName)) return imported;
  const ranked = [...found.chats].sort((a, b) => chatSortMs(b) - chatSortMs(a));
  const selected = ranked.filter((chat) => isPriorityLeadChat(chat) || chatSortMs(chat) > Date.now() - MAX_AGE_MS);
  const unique: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const chat of [...selected.filter(isPriorityLeadChat), ...selected]) {
    const jid = chatRemoteJid(chat);
    if (!jid || seen.has(jid)) continue;
    seen.add(jid);
    unique.push(chat);
    if (unique.length >= RECENT_CHAT_LIMIT) break;
  }
  for (const chat of unique) {
    const jid = chatRemoteJid(chat);
    const messages = await evolutionFindMessages(instanceName, jid, 40);
    if (!messages.ok) continue;
    imported += await importChatPayload({ messages: messages.messages, chat }, instanceName);
  }
  return imported;
}

/**
 * Recupera mensagens que o WhatsApp recebeu e o webhook não gravou no CRM.
 * Throttle para não bater na Evolution a cada poll do Inbox.
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
      await ensureAttendanceEvolutionChannel();
      const instances = await listWhatsappInstances();
      const evolution = instances.filter((item) => !instanceIsMetaCloud(item));
      const names = evolution.length
        ? evolution.map((item) => item.instanceName)
        : [getDefaultSomaEvolutionInstance()];
      for (const instanceName of names) {
        registerOperableEvolutionInstance(instanceName);
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
