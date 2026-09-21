import { extractWhatsAppPhoneFromInbound, isGroupOrBroadcastJid } from "@/lib/chat/phone";

export type EvolutionInboundMessage = {
  phone: string;
  text: string;
  pushName?: string;
  messageId?: string;
  fromMe?: boolean;
  mediaBase64?: string;
  mediaMimeType?: string;
  mediaFileName?: string;
  mediaType?: "image" | "document";
  messageKey: Record<string, unknown>;
  timestampMs?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractText(message: Record<string, unknown>, row: Record<string, unknown>): string {
  const imageMessage = asRecord(message.imageMessage);
  const documentMessage = asRecord(message.documentMessage);
  const mediaMessage = imageMessage ?? documentMessage;
  const buttonsResponse = asRecord(message.buttonsResponseMessage);
  const templateButtonReply = asRecord(message.templateButtonReplyMessage);
  const listResponse = asRecord(message.listResponseMessage);
  const listSingle = asRecord(listResponse?.singleSelectReply);
  const interactiveText =
    (typeof buttonsResponse?.selectedDisplayText === "string" && buttonsResponse.selectedDisplayText) ||
    (typeof buttonsResponse?.selectedButtonId === "string" && buttonsResponse.selectedButtonId) ||
    (typeof templateButtonReply?.selectedDisplayText === "string" &&
      templateButtonReply.selectedDisplayText) ||
    (typeof templateButtonReply?.selectedId === "string" && templateButtonReply.selectedId) ||
    (typeof listResponse?.title === "string" && listResponse.title) ||
    (typeof listSingle?.selectedRowId === "string" && listSingle.selectedRowId) ||
    "";
  return (
    (typeof message.conversation === "string" && message.conversation) ||
    (typeof asRecord(message.extendedTextMessage)?.text === "string" &&
      String(asRecord(message.extendedTextMessage)?.text)) ||
    (typeof row.text === "string" && row.text) ||
    (typeof mediaMessage?.caption === "string" && mediaMessage.caption) ||
    interactiveText ||
    ""
  );
}

function extractTimestampMs(row: Record<string, unknown>): number | undefined {
  const raw =
    row.messageTimestamp ??
    row.timestamp ??
    asRecord(row.messageTimestamp)?.low ??
    row.msgTimestamp;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n > 1_000_000_000_000 ? n : n * 1000;
}

export function extractInboundFromEvolutionNode(row: Record<string, unknown>): EvolutionInboundMessage | null {
  const key = asRecord(row.key) ?? {};
  const message = asRecord(row.message) ?? {};
  const imageMessage = asRecord(message.imageMessage);
  const documentMessage = asRecord(message.documentMessage);
  const mediaMessage = imageMessage ?? documentMessage;
  const mediaType = imageMessage ? "image" : documentMessage ? "document" : undefined;
  const fromMe = Boolean(key.fromMe ?? row.fromMe);
  const remoteJid = String(key.remoteJid ?? row.remoteJid ?? row.id ?? "");
  if (isGroupOrBroadcastJid(remoteJid)) return null;
  const phone = extractWhatsAppPhoneFromInbound({
    remoteJid,
    remoteJidAlt: key.remoteJidAlt ?? row.remoteJidAlt,
    senderPn: key.senderPn ?? row.senderPn,
    participant: key.participant ?? row.participant,
    participantAlt: key.participantAlt ?? row.participantAlt,
    senderLid: key.senderLid ?? row.senderLid,
  });
  const text = extractText(message, row).trim();
  if (!phone || (!text && !mediaMessage)) return null;
  return {
    phone,
    text,
    pushName: typeof row.pushName === "string" ? row.pushName : typeof row.name === "string" ? row.name : undefined,
    messageId: typeof key.id === "string" ? key.id : typeof row.id === "string" ? row.id : undefined,
    fromMe,
    mediaBase64:
      (typeof row.base64 === "string" && row.base64) ||
      (typeof mediaMessage?.base64 === "string" && mediaMessage.base64) ||
      undefined,
    mediaMimeType:
      (typeof mediaMessage?.mimetype === "string" && mediaMessage.mimetype) ||
      (typeof row.mimetype === "string" && row.mimetype) ||
      undefined,
    mediaFileName:
      (typeof mediaMessage?.fileName === "string" && mediaMessage.fileName) ||
      (typeof row.fileName === "string" && row.fileName) ||
      undefined,
    mediaType,
    messageKey: key,
    timestampMs: extractTimestampMs(row),
  };
}

function collectMessageNodes(payload: unknown, out: Record<string, unknown>[], depth = 0): void {
  if (depth > 8 || payload == null) return;
  if (Array.isArray(payload)) {
    for (const item of payload) collectMessageNodes(item, out, depth + 1);
    return;
  }
  const row = asRecord(payload);
  if (!row) return;
  if (row.key || row.message || row.lastMessage) {
    if (row.key || row.message) out.push(row);
    const last = asRecord(row.lastMessage);
    if (last) {
      out.push({
        ...last,
        remoteJidAlt: last.remoteJidAlt ?? row.remoteJidAlt ?? row.id,
        senderPn: last.senderPn ?? row.senderPn,
        pushName: last.pushName ?? row.pushName ?? row.name,
      });
    }
  }
  const nested = row.data ?? row.messages ?? row.records ?? row.chats ?? row.response;
  if (nested && nested !== payload) collectMessageNodes(nested, out, depth + 1);
}

export function extractInboundFromEvolution(payload: unknown): EvolutionInboundMessage[] {
  if (!payload || typeof payload !== "object") return [];
  const nodes: Record<string, unknown>[] = [];
  collectMessageNodes(payload, nodes);
  const out: EvolutionInboundMessage[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    const parsed = extractInboundFromEvolutionNode(node);
    if (!parsed) continue;
    const dedupe = `${parsed.phone}:${parsed.messageId ?? parsed.text}:${parsed.timestampMs ?? ""}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(parsed);
  }
  return out;
}
