import {
  appendMessage,
  getConversation,
  getOrCreateConversationByPhone,
} from "@/lib/chat/chat.repository";
import {
  evolutionGetMediaBase64,
  evolutionSendText,
  isWebhookForSomaInstance,
} from "@/lib/chat/evolution.adapter";
import { saveInboundChatMedia } from "@/lib/chat/chat-media.repository";
import { generateAiReply, isOpenAiConfigured } from "@/lib/chat/openai.adapter";
import { normalizeWhatsAppPhone } from "@/lib/chat/phone";

type EvolutionInboundMessage = {
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
};

function extractInboundFromEvolution(payload: unknown): EvolutionInboundMessage[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;

  // Formato comum Evolution: { event, data: { key, pushName, message } }
  const items = Array.isArray(data) ? data : [data];
  const out: EvolutionInboundMessage[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = (row.key ?? {}) as Record<string, unknown>;
    const message = (row.message ?? {}) as Record<string, unknown>;
    const imageMessage =
      message.imageMessage && typeof message.imageMessage === "object"
        ? (message.imageMessage as Record<string, unknown>)
        : null;
    const documentMessage =
      message.documentMessage && typeof message.documentMessage === "object"
        ? (message.documentMessage as Record<string, unknown>)
        : null;
    const mediaMessage = imageMessage ?? documentMessage;
    const mediaType = imageMessage ? "image" : documentMessage ? "document" : undefined;
    const fromMe = Boolean(key.fromMe ?? row.fromMe);
    const remoteJid = String(key.remoteJid ?? row.remoteJid ?? "");
    const phone = normalizeWhatsAppPhone(remoteJid.split("@")[0] ?? "");
    const text =
      (typeof message.conversation === "string" && message.conversation) ||
      (typeof (message.extendedTextMessage as { text?: string } | undefined)?.text === "string" &&
        (message.extendedTextMessage as { text: string }).text) ||
      (typeof row.text === "string" && row.text) ||
      (typeof mediaMessage?.caption === "string" && mediaMessage.caption) ||
      "";
    const mediaBase64 =
      (typeof row.base64 === "string" && row.base64) ||
      (typeof mediaMessage?.base64 === "string" && mediaMessage.base64) ||
      undefined;
    const mediaMimeType =
      (typeof mediaMessage?.mimetype === "string" && mediaMessage.mimetype) ||
      (typeof row.mimetype === "string" && row.mimetype) ||
      undefined;
    if (!phone || (!text.trim() && !mediaMessage)) continue;
    out.push({
      phone,
      text: text.trim(),
      pushName: typeof row.pushName === "string" ? row.pushName : undefined,
      messageId: typeof key.id === "string" ? key.id : undefined,
      fromMe,
      mediaBase64,
      mediaMimeType,
      mediaFileName:
        (typeof mediaMessage?.fileName === "string" && mediaMessage.fileName) ||
        (typeof row.fileName === "string" && row.fileName) ||
        undefined,
      mediaType,
      messageKey: key,
    });
  }

  return out;
}

async function maybeReplyWithAi(conversationId: string, userText: string): Promise<void> {
  const conversation = await getConversation(conversationId);

  // O estado individual é soberano: o botão geral apenas aplica um comando em massa.
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
    // O atendente pode ter enviado uma mensagem enquanto a resposta era gerada.
    // Revalida antes de publicar para garantir que o takeover manual seja soberano.
    const latestConversation = await getConversation(conversationId);
    if (!latestConversation?.aiEnabled) return;
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
    // Dedupe por wa_message_id fica em appendMessage — evita listMessages completo (lento).

    let media:
      | { mediaId: string; mimeType: string; fileName: string }
      | undefined;
    const isMediaCandidate = msg.mediaType === "image" || msg.mediaType === "document";
    if (isMediaCandidate) {
      let base64 = msg.mediaBase64;
      let mimeType =
        msg.mediaMimeType ?? (msg.mediaType === "document" ? "application/octet-stream" : "image/jpeg");
      if (!base64) {
        const fetched = await evolutionGetMediaBase64(msg.messageKey);
        if (fetched.ok) {
          base64 = fetched.base64;
          mimeType = fetched.mimeType ?? mimeType;
        }
      }
      const normalizedMimeType = mimeType.split(";")[0]?.trim().toLowerCase();
      const supported =
        msg.mediaType === "image"
          ? ["image/jpeg", "image/png", "image/webp"].includes(normalizedMimeType ?? "")
          : normalizedMimeType === "application/pdf";
      if (base64 && supported) {
        const saved = await saveInboundChatMedia({
          base64,
          mimeType,
          fileName: msg.mediaFileName,
          conversationId: conversation.id,
        });
        media = {
          mediaId: saved.mediaId,
          mimeType: saved.mimeType,
          fileName: saved.fileName,
        };
      }
    }

    await appendMessage({
      conversationId: conversation.id,
      direction: "inbound",
      body:
        msg.text ||
        (media
          ? ""
          : msg.mediaType === "document"
            ? "Documento recebido, mas não foi possível carregá-lo."
            : "Imagem recebida, mas não foi possível carregá-la."),
      messageType: media ? (msg.mediaType === "document" ? "document" : "image") : "text",
      mediaId: media?.mediaId,
      mediaMimeType: media?.mimeType,
      mediaFileName: media?.fileName,
      senderType: "contact",
      senderName: msg.pushName ?? conversation.contactName,
      waMessageId: msg.messageId ?? null,
      bumpUnread: true,
    });
    // Processa IA em background não bloqueante (fire-and-forget seguro o suficiente no Node)
    void maybeReplyWithAi(
      conversation.id,
      msg.text ||
        (msg.mediaType === "document"
          ? "O cliente enviou um documento PDF sem legenda."
          : "O cliente enviou uma imagem sem legenda."),
    );
  }

  return Response.json({ ok: true, accepted: inbound.length });
}
