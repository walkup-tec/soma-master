import {
  appendMessage,
  getConversation,
  getOrCreateConversationByPhone,
} from "@/lib/chat/chat.repository";
import {
  evolutionGetMediaBase64,
  extractEvolutionInstanceName,
  getDefaultSomaEvolutionInstance,
  isWebhookForSomaInstance,
} from "@/lib/chat/evolution.adapter";
import { extractInboundFromEvolution } from "@/lib/chat/evolution-inbound";
import { sendChannelText } from "@/lib/chat/channel-outbound";
import { saveInboundChatMedia } from "@/lib/chat/chat-media.repository";
import { generateAiReply, isOpenAiConfigured } from "@/lib/chat/openai.adapter";
import { maybeRunChatbotRuntime } from "@/lib/bots/bot-inbound.service";
import { timingSafeEqualString } from "@/lib/chat/meta-cloud/timing-safe";

function evolutionWebhookAuthorized(request: Request): boolean {
  const secret = process.env.CHAT_WEBHOOK_SECRET?.trim();
  const evoKey = process.env.EVOLUTION_API_KEY?.trim();
  if (!secret) return true;
  const provided =
    request.headers.get("x-soma-webhook-secret") ?? request.headers.get("apikey") ?? "";
  if (timingSafeEqualString(provided, secret)) return true;
  // Evolution costuma mandar só o apikey global e ignora headers customizados.
  if (evoKey && timingSafeEqualString(provided, evoKey)) return true;
  return false;
}

async function maybeReplyWithAi(conversationId: string, userText: string): Promise<void> {
  const conversation = await getConversation(conversationId);

  // O estado individual é soberano: o botão geral apenas aplica um comando em massa.
  if (!conversation?.aiEnabled) return;
  // Bot e IA são mutuamente exclusivos
  if (conversation.botEnabled) return;
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
    const send = await sendChannelText({
      phone: conversation.phone,
      text: reply,
      instanceName: conversation.instanceName ?? undefined,
      conversationId,
    });
    if (!send.ok) {
      await appendMessage({
        conversationId,
        direction: "outbound",
        body: `⚠️ IA salvou no CRM, mas não entregou no WhatsApp: ${send.error ?? "erro desconhecido"}`,
        senderType: "system",
        senderName: "Sistema",
      });
    }
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
  if (!evolutionWebhookAuthorized(request)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
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

  const inboundInstance =
    extractEvolutionInstanceName(payload) || getDefaultSomaEvolutionInstance();

  const inbound = extractInboundFromEvolution(payload).filter((m) => !m.fromMe);
  for (const msg of inbound) {
    const conversation = await getOrCreateConversationByPhone({
      phone: msg.phone,
      contactName: msg.pushName ?? null,
      instanceName: inboundInstance,
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

    const inboundText =
      msg.text ||
      (msg.mediaType === "document"
        ? "O cliente enviou um documento PDF sem legenda."
        : "O cliente enviou uma imagem sem legenda.");

    // Aguarda o bot (e a IA) antes de responder o webhook — evita perda do processamento
    // em ambientes que descartam trabalho após o Response (Vite/dev e alguns proxies).
    try {
      const handledByBot = await maybeRunChatbotRuntime({
        conversationId: conversation.id,
        phone: conversation.phone,
        inboundText,
      });
      if (!handledByBot) {
        await maybeReplyWithAi(conversation.id, inboundText);
      }
    } catch (error) {
      console.error("[chat] chatbot runtime failed", error);
      try {
        await maybeReplyWithAi(conversation.id, inboundText);
      } catch (aiError) {
        console.error("[chat] AI fallback failed", aiError);
      }
    }
  }

  return Response.json({ ok: true, accepted: inbound.length });
}
