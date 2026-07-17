import {
  appendMessage,
  getChatAiSettings,
  getConversation,
  getOrCreateConversationByPhone,
} from "@/lib/chat/chat.repository";
import { evolutionSendText, isWebhookForSomaInstance } from "@/lib/chat/evolution.adapter";
import { generateAiReply, isOpenAiConfigured } from "@/lib/chat/openai.adapter";
import { normalizeWhatsAppPhone } from "@/lib/chat/phone";

function extractInboundFromEvolution(payload: unknown): Array<{
  phone: string;
  text: string;
  pushName?: string;
  messageId?: string;
  fromMe?: boolean;
}> {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;

  // Formato comum Evolution: { event, data: { key, pushName, message } }
  const items = Array.isArray(data) ? data : [data];
  const out: Array<{ phone: string; text: string; pushName?: string; messageId?: string; fromMe?: boolean }> = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = (row.key ?? {}) as Record<string, unknown>;
    const message = (row.message ?? {}) as Record<string, unknown>;
    const fromMe = Boolean(key.fromMe ?? row.fromMe);
    const remoteJid = String(key.remoteJid ?? row.remoteJid ?? "");
    const phone = normalizeWhatsAppPhone(remoteJid.split("@")[0] ?? "");
    const text =
      (typeof message.conversation === "string" && message.conversation) ||
      (typeof (message.extendedTextMessage as { text?: string } | undefined)?.text === "string" &&
        (message.extendedTextMessage as { text: string }).text) ||
      (typeof row.text === "string" && row.text) ||
      "";
    if (!phone || !text.trim()) continue;
    out.push({
      phone,
      text: text.trim(),
      pushName: typeof row.pushName === "string" ? row.pushName : undefined,
      messageId: typeof key.id === "string" ? key.id : undefined,
      fromMe,
    });
  }

  return out;
}

async function maybeReplyWithAi(conversationId: string, userText: string): Promise<void> {
  const [settings, conversation] = await Promise.all([
    getChatAiSettings(),
    getConversation(conversationId),
  ]);

  if (!settings.aiGlobalEnabled) return;
  if (!conversation?.aiEnabled) return;
  if (!isOpenAiConfigured()) {
    await appendMessage({
      conversationId,
      direction: "outbound",
      body: "IA ligada, mas OPENAI_API_KEY ainda não está configurada no servidor.",
      senderType: "system",
      senderName: "Sistema",
    });
    return;
  }

  try {
    const reply = await generateAiReply({
      conversationId,
      latestUserMessage: userText,
    });
    await appendMessage({
      conversationId,
      direction: "outbound",
      body: reply,
      senderType: "ai",
      senderName: "Assistente Soma",
    });
    await evolutionSendText({ phone: conversation.phone, text: reply });
  } catch (error) {
    console.error("[chat] AI reply failed", error);
    await appendMessage({
      conversationId,
      direction: "outbound",
      body: `Falha da IA: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      senderType: "system",
      senderName: "Sistema",
    });
  }
}

/** Webhook público Evolution → inbox Soma. */
export async function handleEvolutionWebhook(request: Request): Promise<Response> {
  const secret = process.env.CHAT_WEBHOOK_SECRET?.trim();
  if (secret) {
    const header = request.headers.get("x-soma-webhook-secret") ?? request.headers.get("apikey") ?? "";
    if (header !== secret) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  if (request.method === "GET") {
    return Response.json({ ok: true, service: "soma-chat-webhook" });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const event = String((payload as { event?: string })?.event ?? "")
    .toLowerCase()
    .replace(/_/g, ".");
  // Evolution: messages.upsert / MESSAGES_UPSERT
  if (event && !event.includes("message")) {
    return Response.json({ ok: true, ignored: true, event });
  }

  // Isolamento: ignora webhooks de outras instâncias no mesmo EVO (WABA, aquecedor, etc.)
  if (!isWebhookForSomaInstance(payload)) {
    return Response.json({ ok: true, ignored: true, reason: "foreign-instance" });
  }

  const inbound = extractInboundFromEvolution(payload).filter((m) => !m.fromMe);
  for (const msg of inbound) {
    const conversation = await getOrCreateConversationByPhone({
      phone: msg.phone,
      contactName: msg.pushName ?? null,
    });
    await appendMessage({
      conversationId: conversation.id,
      direction: "inbound",
      body: msg.text,
      senderType: "contact",
      senderName: msg.pushName ?? conversation.contactName,
      waMessageId: msg.messageId ?? null,
      bumpUnread: true,
    });
    // Processa IA em background não bloqueante (fire-and-forget seguro o suficiente no Node)
    void maybeReplyWithAi(conversation.id, msg.text);
  }

  return Response.json({ ok: true, accepted: inbound.length });
}
