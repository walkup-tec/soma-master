import { appendMessage, getOrCreateConversationByPhone } from "@/lib/chat/chat.repository";
import {
  evolutionFindRecentChats,
  getDefaultSomaEvolutionInstance,
  isEvolutionConfigured,
} from "@/lib/chat/evolution.adapter";
import { extractInboundFromEvolution } from "@/lib/chat/evolution-inbound";
import { instanceIsMetaCloud } from "@/lib/chat/meta-cloud/meta-cloud.adapter";
import { listWhatsappInstances } from "@/lib/chat/whatsapp-instances.repository";

const PULL_COOLDOWN_MS = 45_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let lastPullAt = 0;
let inFlight: Promise<number> | null = null;

async function importChatPayload(payload: unknown, instanceName: string): Promise<number> {
  const inbound = extractInboundFromEvolution(payload).filter((msg) => !msg.fromMe);
  let imported = 0;
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const msg of inbound) {
    if (msg.timestampMs && msg.timestampMs < cutoff) continue;
    const body =
      msg.text ||
      (msg.mediaType === "document" ? "Documento recebido no WhatsApp." : msg.mediaType === "image" ? "Imagem recebida no WhatsApp." : "");
    if (!body) continue;
    const conversation = await getOrCreateConversationByPhone({
      phone: msg.phone,
      contactName: msg.pushName ?? null,
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
        direction: "inbound",
        body,
        senderType: "contact",
        senderName: msg.pushName ?? conversation.contactName,
        waMessageId: msg.messageId ?? null,
        bumpUnread: true,
      });
      imported += 1;
    } catch (error) {
      console.warn("[chat] falha ao importar inbound Evolution", msg.phone, error);
    }
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
      const instances = await listWhatsappInstances();
      const evolution = instances.filter((item) => !instanceIsMetaCloud(item));
      const names = evolution.length
        ? evolution.map((item) => item.instanceName)
        : [getDefaultSomaEvolutionInstance()];
      for (const instanceName of names) {
        const found = await evolutionFindRecentChats(instanceName, 40);
        if (!found.ok) {
          console.warn("[chat] findChats falhou ao recuperar inbound", instanceName, found.error);
          continue;
        }
        imported += await importChatPayload({ chats: found.chats }, instanceName);
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
