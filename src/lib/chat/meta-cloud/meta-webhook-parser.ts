/** Parser mínimo do payload Cloud API (messages) para o inbox Soma. */

export type MetaCloudInboundMessage = {
  phoneNumberId: string;
  wabaId: string | null;
  fromWaId: string;
  contactName: string | null;
  messageId: string | null;
  timestamp: string | null;
  text: string;
  messageType: string;
  mediaId: string | null;
  mimeType: string | null;
  fileName: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return String(value || "").trim();
}

function contactNameFor(value: Record<string, unknown>, waId: string): string | null {
  for (const item of asArray(value.contacts)) {
    const row = asRecord(item);
    if (text(row.wa_id) === waId) {
      return text(asRecord(row.profile).name) || null;
    }
  }
  return null;
}

function extractText(msg: Record<string, unknown>, messageType: string): string {
  if (messageType === "text") return text(asRecord(msg.text).body);
  if (messageType === "button") return text(asRecord(msg.button).text) || text(asRecord(msg.button).payload);
  if (messageType === "interactive") {
    const interactive = asRecord(msg.interactive);
    const buttonReply = asRecord(interactive.button_reply);
    const listReply = asRecord(interactive.list_reply);
    return (
      text(buttonReply.title) ||
      text(buttonReply.id) ||
      text(listReply.title) ||
      text(listReply.id) ||
      text(asRecord(interactive.nfm_reply).response_json)
    );
  }
  const image = asRecord(msg.image);
  const document = asRecord(msg.document);
  return text(image.caption) || text(document.caption);
}

export function parseMetaCloudInboundMessages(payload: unknown): MetaCloudInboundMessage[] {
  const root = asRecord(payload);
  const out: MetaCloudInboundMessage[] = [];
  for (const entry of asArray(root.entry)) {
    const entryObj = asRecord(entry);
    const wabaId = text(entryObj.id) || null;
    for (const change of asArray(entryObj.changes)) {
      const changeObj = asRecord(change);
      if (text(changeObj.field) !== "messages") continue;
      const value = asRecord(changeObj.value);
      const phoneNumberId = text(asRecord(value.metadata).phone_number_id);
      if (!phoneNumberId) continue;
      for (const message of asArray(value.messages)) {
        const msg = asRecord(message);
        const fromWaId = text(msg.from);
        if (!fromWaId) continue;
        const messageType = text(msg.type) || "text";
        const image = asRecord(msg.image);
        const document = asRecord(msg.document);
        const mediaId = text(image.id) || text(document.id) || null;
        const mimeType = text(image.mime_type) || text(document.mime_type) || null;
        const fileName = text(document.filename) || null;
        const extracted = extractText(msg, messageType);
        if (!extracted && !mediaId) continue;
        out.push({
          phoneNumberId,
          wabaId,
          fromWaId,
          contactName: contactNameFor(value, fromWaId),
          messageId: text(msg.id) || null,
          timestamp: text(msg.timestamp) || null,
          text: extracted,
          messageType,
          mediaId,
          mimeType,
          fileName,
        });
      }
    }
  }
  return out;
}

export function collectMetaCloudPhoneNumberIds(payload: unknown): string[] {
  const ids = new Set<string>();
  for (const msg of parseMetaCloudInboundMessages(payload)) {
    if (msg.phoneNumberId) ids.add(msg.phoneNumberId);
  }
  const root = asRecord(payload);
  for (const entry of asArray(root.entry)) {
    for (const change of asArray(asRecord(entry).changes)) {
      const phoneNumberId = text(asRecord(asRecord(asRecord(change).value).metadata).phone_number_id);
      if (phoneNumberId) ids.add(phoneNumberId);
    }
  }
  return [...ids];
}
