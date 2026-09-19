/**
 * Envio unificado Chat/IA/Bot: Evolution (QR) ou Cloud API (oficial), conforme o canal integrado agora.
 */

import { resolveOutboundChannel } from "@/lib/chat/whatsapp-channel-lock";
import {
  metaCloudSendButtons,
  metaCloudSendImage,
  metaCloudSendText,
  type ChannelSendResult,
} from "@/lib/chat/meta-cloud/meta-cloud.adapter";
import {
  evolutionSendButtons,
  evolutionSendImage,
  evolutionSendText,
} from "@/lib/chat/evolution.adapter";

async function withOutboundChannel<T extends ChannelSendResult>(
  instanceName: string | null | undefined,
  send: (target: { provider: "evolution" | "meta_cloud"; instanceName: string }) => Promise<T>,
): Promise<T | ChannelSendResult> {
  try {
    const target = await resolveOutboundChannel(instanceName);
    return await send(target);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao escolher o canal WhatsApp.",
    };
  }
}

export async function sendChannelText(input: {
  phone: string;
  text: string;
  instanceName?: string | null;
  conversationId?: string | null;
}): Promise<ChannelSendResult> {
  return withOutboundChannel(input.instanceName, (target) => {
    if (target.provider === "meta_cloud") {
      return metaCloudSendText({ ...input, instanceName: target.instanceName });
    }
    return evolutionSendText({
      phone: input.phone,
      text: input.text,
      instanceName: target.instanceName,
    });
  });
}

export async function sendChannelButtons(input: {
  phone: string;
  title: string;
  description?: string;
  buttons: Array<{ id: string; displayText: string }>;
  instanceName?: string | null;
  conversationId?: string | null;
}): Promise<ChannelSendResult> {
  return withOutboundChannel(input.instanceName, (target) => {
    if (target.provider === "meta_cloud") {
      return metaCloudSendButtons({ ...input, instanceName: target.instanceName });
    }
    return evolutionSendButtons({
      phone: input.phone,
      title: input.title,
      description: input.description,
      buttons: input.buttons,
      instanceName: target.instanceName,
    });
  });
}

export async function sendChannelImage(input: {
  phone: string;
  dataUrl: string;
  mimeType: string;
  fileName: string;
  caption?: string;
  instanceName?: string | null;
  conversationId?: string | null;
}): Promise<ChannelSendResult> {
  return withOutboundChannel(input.instanceName, (target) => {
    if (target.provider === "meta_cloud") {
      return metaCloudSendImage({ ...input, instanceName: target.instanceName });
    }
    return evolutionSendImage({
      phone: input.phone,
      dataUrl: input.dataUrl,
      mimeType: input.mimeType,
      fileName: input.fileName,
      caption: input.caption,
      instanceName: target.instanceName,
    });
  });
}
