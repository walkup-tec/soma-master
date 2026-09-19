/**
 * API Oficial (Cloud) e QR Evolution são mutuamente exclusivos.
 * O envio segue o canal realmente cadastrado agora — não o instance_name histórico da conversa.
 */

import { getDefaultSomaEvolutionInstance } from "@/lib/chat/evolution.adapter";
import { isMetaCloudInstanceName } from "@/lib/chat/meta-cloud/meta-cloud.constants";
import {
  listWhatsappInstances,
  type ChatWhatsappInstance,
  type ChatWhatsappProvider,
} from "@/lib/chat/whatsapp-instances.repository";

export const WHATSAPP_EXCLUSIVE_CHANNEL_ERROR =
  "API Oficial e QR Code não podem ficar conectados ao mesmo tempo. Desconecte um canal antes de integrar o outro.";

export type OutboundChannel = {
  provider: ChatWhatsappProvider;
  instanceName: string;
};

export function isCloudWhatsappInstance(instance: ChatWhatsappInstance): boolean {
  return instance.provider === "meta_cloud" || isMetaCloudInstanceName(instance.instanceName);
}

export function isLiveCloudWhatsappInstance(instance: ChatWhatsappInstance): boolean {
  return (
    isCloudWhatsappInstance(instance) &&
    Boolean(instance.phoneNumberId && instance.accessTokenEncrypted)
  );
}

export function splitWhatsappFamilies(instances: ChatWhatsappInstance[]): {
  cloud: ChatWhatsappInstance[];
  evolution: ChatWhatsappInstance[];
} {
  const cloud: ChatWhatsappInstance[] = [];
  const evolution: ChatWhatsappInstance[] = [];
  for (const instance of instances) {
    if (isCloudWhatsappInstance(instance)) cloud.push(instance);
    else evolution.push(instance);
  }
  return { cloud, evolution };
}

export function exclusiveFamilyConflict(
  instances: ChatWhatsappInstance[],
  family: ChatWhatsappProvider,
): string | null {
  const { cloud, evolution } = splitWhatsappFamilies(instances);
  if (family === "meta_cloud" && evolution.length > 0) return WHATSAPP_EXCLUSIVE_CHANNEL_ERROR;
  if (family === "evolution" && cloud.length > 0) return WHATSAPP_EXCLUSIVE_CHANNEL_ERROR;
  return null;
}

export async function assertWhatsappFamilyAvailable(family: ChatWhatsappProvider): Promise<void> {
  const conflict = exclusiveFamilyConflict(await listWhatsappInstances(), family);
  if (conflict) throw new Error(conflict);
}

export function liveWhatsappProvider(
  instances: ChatWhatsappInstance[],
): ChatWhatsappProvider | null {
  const { cloud, evolution } = splitWhatsappFamilies(instances);
  const liveCloud = cloud.filter(isLiveCloudWhatsappInstance);
  if (evolution.length > 0 && liveCloud.length === 0) return "evolution";
  if (liveCloud.length > 0 && evolution.length === 0) return "meta_cloud";
  if (evolution.length > 0) return "evolution";
  if (liveCloud.length > 0) return "meta_cloud";
  return null;
}

function pickEvolutionInstance(
  evolution: ChatWhatsappInstance[],
  requested: string,
): ChatWhatsappInstance | null {
  if (evolution.length === 0) return null;
  const exact = requested
    ? evolution.find((item) => item.instanceName === requested)
    : undefined;
  if (exact) return exact;
  const fallbackName = getDefaultSomaEvolutionInstance();
  return evolution.find((item) => item.instanceName === fallbackName) ?? evolution[0] ?? null;
}

function pickCloudInstance(
  cloud: ChatWhatsappInstance[],
  requested: string,
): ChatWhatsappInstance | null {
  const live = cloud.filter(isLiveCloudWhatsappInstance);
  if (live.length === 0) return null;
  const exact = requested ? live.find((item) => item.instanceName === requested) : undefined;
  return exact ?? live[0] ?? null;
}

/**
 * Canal de saída: usa o canal cadastrado agora.
 * Conversas antigas `meta-*` (oficial já desconectado) saem pelo QR Evolution integrado.
 */
export async function resolveOutboundChannel(
  requestedName?: string | null,
): Promise<OutboundChannel> {
  const requested = String(requestedName || "").trim();
  const instances = await listWhatsappInstances();
  const { cloud, evolution } = splitWhatsappFamilies(instances);

  const requestedInst = requested
    ? instances.find((item) => item.instanceName === requested) ?? null
    : null;

  if (requestedInst) {
    if (isCloudWhatsappInstance(requestedInst)) {
      if (isLiveCloudWhatsappInstance(requestedInst)) {
        return { provider: "meta_cloud", instanceName: requestedInst.instanceName };
      }
    } else {
      return { provider: "evolution", instanceName: requestedInst.instanceName };
    }
  }

  const liveCloud = pickCloudInstance(cloud, requested);
  const liveEvo = pickEvolutionInstance(evolution, requested);

  if (liveEvo && !liveCloud) {
    return { provider: "evolution", instanceName: liveEvo.instanceName };
  }
  if (liveCloud && !liveEvo) {
    return { provider: "meta_cloud", instanceName: liveCloud.instanceName };
  }
  if (liveEvo) {
    return { provider: "evolution", instanceName: liveEvo.instanceName };
  }
  if (liveCloud) {
    return { provider: "meta_cloud", instanceName: liveCloud.instanceName };
  }

  throw new Error(
    "Nenhum canal WhatsApp conectado. Integre a API Oficial ou o QR Code Evolution.",
  );
}
