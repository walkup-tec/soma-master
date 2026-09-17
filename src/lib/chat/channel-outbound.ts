/**
 * Envio unificado Chat/IA/Bot: Evolution (QR) ou Cloud API (oficial), conforme o canal.
 */

import {
  instanceIsMetaCloud,
  metaCloudSendButtons,
  metaCloudSendImage,
  metaCloudSendText,
  type ChannelSendResult,
} from "@/lib/chat/meta-cloud/meta-cloud.adapter";
import { isMetaCloudInstanceName } from "@/lib/chat/meta-cloud/meta-cloud.constants";
import {
  evolutionSendButtons,
  evolutionSendImage,
  evolutionSendText,
} from "@/lib/chat/evolution.adapter";
import { getWhatsappInstanceByName } from "@/lib/chat/whatsapp-instances.repository";

async function resolveIsMetaCloud(instanceName?: string | null): Promise<boolean> {
  const name = String(instanceName || "").trim();
  if (isMetaCloudInstanceName(name)) return true;
  if (!name) return false;
  const instance = await getWhatsappInstanceByName(name);
  return instanceIsMetaCloud(instance);
}

export async function sendChannelText(input: {
  phone: string;
  text: string;
  instanceName?: string | null;
  conversationId?: string | null;
}): Promise<ChannelSendResult> {
  if (await resolveIsMetaCloud(input.instanceName)) {
    return metaCloudSendText(input);
  }
  return evolutionSendText({
    phone: input.phone,
    text: input.text,
    instanceName: input.instanceName ?? undefined,
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
  if (await resolveIsMetaCloud(input.instanceName)) {
    return metaCloudSendButtons(input);
  }
  return evolutionSendButtons({
    phone: input.phone,
    title: input.title,
    description: input.description,
    buttons: input.buttons,
    instanceName: input.instanceName ?? undefined,
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
  if (await resolveIsMetaCloud(input.instanceName)) {
    return metaCloudSendImage(input);
  }
  return evolutionSendImage({
    phone: input.phone,
    dataUrl: input.dataUrl,
    mimeType: input.mimeType,
    fileName: input.fileName,
    caption: input.caption,
    instanceName: input.instanceName ?? undefined,
  });
}
