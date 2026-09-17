/**
 * Cloud API WhatsApp — envio Graph (janela de 24h) para canais oficiais do Chat Soma.
 */

import { getLastInboundMessageAt } from "@/lib/chat/chat.repository";
import { isMetaCloudInstanceName } from "@/lib/chat/meta-cloud/meta-cloud.constants";
import {
  readMetaGraphBase,
  readMetaGraphVersion,
} from "@/lib/chat/meta-cloud/meta-config";
import {
  callMetaGraphJson,
  postMetaCloudMessage,
  publicGraphError,
} from "@/lib/chat/meta-cloud/meta-graph.client";
import { decryptMetaToken } from "@/lib/chat/meta-cloud/meta-token-crypto";
import { normalizeWhatsAppPhone } from "@/lib/chat/phone";
import {
  getWhatsappInstanceByName,
  type ChatWhatsappInstance,
} from "@/lib/chat/whatsapp-instances.repository";

export { isMetaCloudInstanceName, metaCloudInstanceName } from "@/lib/chat/meta-cloud/meta-cloud.constants";
export const META_CLOUD_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ChannelSendResult = { ok: boolean; error?: string; wamid?: string | null; raw?: unknown };

export function instanceIsMetaCloud(instance: Pick<ChatWhatsappInstance, "provider" | "instanceName"> | null | undefined): boolean {
  if (!instance) return false;
  if (instance.provider === "meta_cloud") return true;
  return isMetaCloudInstanceName(instance.instanceName);
}

async function resolveCloudChannel(instanceName?: string | null): Promise<ChatWhatsappInstance> {
  const name = String(instanceName || "").trim();
  if (!name) throw new Error("Canal WhatsApp oficial não informado.");
  const instance = await getWhatsappInstanceByName(name);
  if (!instance || !instanceIsMetaCloud(instance)) {
    throw new Error(`Canal "${name}" não é um número da API oficial.`);
  }
  if (!instance.phoneNumberId || !instance.accessTokenEncrypted) {
    throw new Error("Número oficial sem token. Reconecte pelo Embedded Signup.");
  }
  return instance;
}

export async function conversationIsInsideCloudWindow(conversationId: string): Promise<boolean> {
  const last = await getLastInboundMessageAt(conversationId);
  if (!last) return false;
  return Date.now() - last.getTime() < META_CLOUD_WINDOW_MS;
}

async function assertCloudWindow(conversationId?: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!conversationId) return { ok: true };
  const inside = await conversationIsInsideCloudWindow(conversationId);
  if (inside) return { ok: true };
  return {
    ok: false,
    error: "Janela de 24h da Cloud API encerrada. Aguarde uma mensagem do lead ou envie um template aprovado.",
  };
}

function toWaId(phone: string): string {
  return normalizeWhatsAppPhone(phone);
}

export async function metaCloudSendText(input: {
  phone: string;
  text: string;
  instanceName?: string | null;
  conversationId?: string | null;
}): Promise<ChannelSendResult> {
  const windowCheck = await assertCloudWindow(input.conversationId);
  if (!windowCheck.ok) return windowCheck;
  try {
    const channel = await resolveCloudChannel(input.instanceName);
    const token = decryptMetaToken(channel.accessTokenEncrypted!);
    const to = toWaId(input.phone);
    const body = String(input.text || "").trim();
    if (!to || !body) return { ok: false, error: "Destino ou texto vazio." };
    const result = await postMetaCloudMessage({
      token,
      phoneNumberId: channel.phoneNumberId!,
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body },
      },
    });
    if (!result.ok) return { ok: false, error: publicGraphError(result) };
    return { ok: true, wamid: result.wamid };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao enviar na Cloud API." };
  }
}

export async function metaCloudSendButtons(input: {
  phone: string;
  title: string;
  buttons: Array<{ id: string; displayText: string }>;
  instanceName?: string | null;
  conversationId?: string | null;
}): Promise<ChannelSendResult> {
  const windowCheck = await assertCloudWindow(input.conversationId);
  if (!windowCheck.ok) return windowCheck;
  try {
    const channel = await resolveCloudChannel(input.instanceName);
    const token = decryptMetaToken(channel.accessTokenEncrypted!);
    const to = toWaId(input.phone);
    const body = String(input.title || "").trim();
    const buttons = (input.buttons || []).slice(0, 3).filter((b) => b.id && b.displayText);
    if (!to || !body || buttons.length === 0) return { ok: false, error: "Botões inválidos." };
    const result = await postMetaCloudMessage({
      token,
      phoneNumberId: channel.phoneNumberId!,
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body.slice(0, 1024) },
          action: {
            buttons: buttons.map((button) => ({
              type: "reply",
              reply: {
                id: String(button.id).slice(0, 256),
                title: String(button.displayText).slice(0, 20),
              },
            })),
          },
        },
      },
    });
    if (!result.ok) return { ok: false, error: publicGraphError(result) };
    return { ok: true, wamid: result.wamid };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao enviar botões na Cloud API." };
  }
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const raw = String(dataUrl || "").trim();
  const match = raw.match(/^data:([^;]+);base64,(.+)$/i);
  if (match) {
    return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(raw) && raw.length > 32) {
    return { mimeType: "image/jpeg", buffer: Buffer.from(raw.replace(/\s+/g, ""), "base64") };
  }
  return null;
}

export async function metaCloudSendImage(input: {
  phone: string;
  dataUrl: string;
  mimeType: string;
  fileName: string;
  caption?: string;
  instanceName?: string | null;
  conversationId?: string | null;
}): Promise<ChannelSendResult> {
  const windowCheck = await assertCloudWindow(input.conversationId);
  if (!windowCheck.ok) return windowCheck;
  try {
    const channel = await resolveCloudChannel(input.instanceName);
    const token = decryptMetaToken(channel.accessTokenEncrypted!);
    const parsed = dataUrlToBuffer(input.dataUrl);
    if (!parsed) return { ok: false, error: "Imagem vazia ou inválida." };
    const mimeType = input.mimeType || parsed.mimeType || "image/jpeg";
    const form = new FormData();
    form.set("messaging_product", "whatsapp");
    form.set("type", mimeType);
    form.set("file", new Blob([new Uint8Array(parsed.buffer)], { type: mimeType }), input.fileName || "image.jpg");

    const uploadUrl = `${readMetaGraphBase()}/${readMetaGraphVersion()}/${channel.phoneNumberId}/media`;
    const upload = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    const uploaded = (await upload.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null;
    const mediaId = String(uploaded?.id || "").trim();
    if (!upload.ok || !mediaId) {
      return { ok: false, error: uploaded?.error?.message || "Falha ao enviar a imagem para a Meta." };
    }

    const to = toWaId(input.phone);
    const result = await postMetaCloudMessage({
      token,
      phoneNumberId: channel.phoneNumberId!,
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "image",
        image: {
          id: mediaId,
          caption: String(input.caption || "").trim().slice(0, 1024) || undefined,
        },
      },
    });
    if (!result.ok) return { ok: false, error: publicGraphError(result) };
    return { ok: true, wamid: result.wamid };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao enviar imagem na Cloud API." };
  }
}

export async function metaCloudDownloadMedia(input: {
  mediaId: string;
  instanceName: string;
}): Promise<{ ok: true; base64: string; mimeType: string } | { ok: false; error: string }> {
  try {
    const channel = await resolveCloudChannel(input.instanceName);
    const token = decryptMetaToken(channel.accessTokenEncrypted!);
    const meta = await callMetaGraphJson({
      token,
      method: "GET",
      path: input.mediaId,
    });
    const url = String((meta.json as { url?: unknown } | null)?.url || "").trim();
    const mimeType = String((meta.json as { mime_type?: unknown } | null)?.mime_type || "image/jpeg");
    if (!meta.ok || !url) {
      return { ok: false, error: publicGraphError(meta) };
    }
    const file = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!file.ok) return { ok: false, error: `Download da mídia falhou (${file.status}).` };
    const buffer = Buffer.from(await file.arrayBuffer());
    return { ok: true, base64: buffer.toString("base64"), mimeType };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao baixar mídia da Meta." };
  }
}
