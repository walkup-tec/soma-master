import {
  appendMessage,
  getConversation,
  getOrCreateConversationByPhone,
} from "@/lib/chat/chat.repository";
import { saveInboundChatMedia } from "@/lib/chat/chat-media.repository";
import { generateAiReply, isOpenAiConfigured } from "@/lib/chat/openai.adapter";
import { metaCloudDownloadMedia } from "@/lib/chat/meta-cloud/meta-cloud.adapter";
import { parseMetaCloudInboundMessages } from "@/lib/chat/meta-cloud/meta-webhook-parser";
import { metaCloudInstanceName } from "@/lib/chat/meta-cloud/meta-cloud.constants";
import { sendChannelText } from "@/lib/chat/channel-outbound";
import { maybeRunChatbotRuntime } from "@/lib/bots/bot-inbound.service";
import { getWhatsappInstanceByPhoneNumberId } from "@/lib/chat/whatsapp-instances.repository";
import { normalizeWhatsAppPhone } from "@/lib/chat/phone";
import { timingSafeEqualString } from "@/lib/chat/meta-cloud/timing-safe";

function webhookAuthorized(request: Request): boolean {
  const wabaKey = process.env.SOMA_WABA_INTEGRATION_KEY?.trim();
  const secret = process.env.CHAT_WEBHOOK_SECRET?.trim();
  const provided =
    request.headers.get("x-soma-waba-key") ??
    request.headers.get("x-soma-webhook-secret") ??
    request.headers.get("apikey") ??
    "";
  if (wabaKey && timingSafeEqualString(provided, wabaKey)) return true;
  if (secret && timingSafeEqualString(provided, secret)) return true;
  return false;
}

async function maybeReplyWithAi(conversationId: string, userText: string): Promise<void> {
  const conversation = await getConversation(conversationId);
  if (!conversation?.aiEnabled) return;
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
    console.error("[chat] AI reply failed (cloud)", error);
    await appendMessage({
      conversationId,
      direction: "outbound",
      body: `Falha da IA: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      senderType: "system",
      senderName: "Sistema",
    });
  }
}

/** Webhook Cloud API — o WABA reenvia o payload Meta já autorizado no App. */
export async function handleMetaCloudWebhook(request: Request): Promise<Response> {
  if (!webhookAuthorized(request)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (request.method === "GET") {
    return Response.json({ ok: true, service: "soma-chat-cloud-webhook" });
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

  const inbound = parseMetaCloudInboundMessages(payload);
  let accepted = 0;

  for (const msg of inbound) {
    const channel = await getWhatsappInstanceByPhoneNumberId(msg.phoneNumberId);
    if (!channel) continue;

    const phone = normalizeWhatsAppPhone(msg.fromWaId);
    if (!phone) continue;

    const instanceName = channel.instanceName || metaCloudInstanceName(msg.phoneNumberId);
    const conversation = await getOrCreateConversationByPhone({
      phone,
      contactName: msg.contactName,
      instanceName,
    });

    let media:
      | { mediaId: string; mimeType: string; fileName: string }
      | undefined;
    const wantsImage = msg.messageType === "image" && msg.mediaId;
    const wantsDocument = msg.messageType === "document" && msg.mediaId;
    if (wantsImage || wantsDocument) {
      const downloaded = await metaCloudDownloadMedia({
        mediaId: msg.mediaId!,
        instanceName,
      });
      if (downloaded.ok) {
        const mimeType = downloaded.mimeType || msg.mimeType || (wantsDocument ? "application/pdf" : "image/jpeg");
        const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
        const supported = wantsDocument
          ? normalized === "application/pdf"
          : ["image/jpeg", "image/png", "image/webp"].includes(normalized);
        if (supported) {
          const saved = await saveInboundChatMedia({
            base64: downloaded.base64,
            mimeType,
            fileName: msg.fileName,
            conversationId: conversation.id,
          });
          media = {
            mediaId: saved.mediaId,
            mimeType: saved.mimeType,
            fileName: saved.fileName,
          };
        }
      }
    }

    await appendMessage({
      conversationId: conversation.id,
      direction: "inbound",
      body:
        msg.text ||
        (media
          ? ""
          : wantsDocument
            ? "Documento recebido, mas não foi possível carregá-lo."
            : wantsImage
              ? "Imagem recebida, mas não foi possível carregá-la."
              : ""),
      messageType: media ? (wantsDocument ? "document" : "image") : "text",
      mediaId: media?.mediaId,
      mediaMimeType: media?.mimeType,
      mediaFileName: media?.fileName,
      senderType: "contact",
      senderName: msg.contactName ?? conversation.contactName,
      waMessageId: msg.messageId ?? null,
      bumpUnread: true,
    });

    const inboundText =
      msg.text ||
      (wantsDocument
        ? "O cliente enviou um documento PDF sem legenda."
        : wantsImage
          ? "O cliente enviou uma imagem sem legenda."
          : "");

    try {
      const handledByBot = await maybeRunChatbotRuntime({
        conversationId: conversation.id,
        phone: conversation.phone,
        inboundText,
      });
      if (!handledByBot && inboundText) {
        await maybeReplyWithAi(conversation.id, inboundText);
      }
    } catch (error) {
      console.error("[chat] cloud chatbot runtime failed", error);
      try {
        if (inboundText) await maybeReplyWithAi(conversation.id, inboundText);
      } catch (aiError) {
        console.error("[chat] cloud AI fallback failed", aiError);
      }
    }
    accepted += 1;
  }

  return Response.json({ ok: true, accepted });
}
