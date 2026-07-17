import { SOMA_EVOLUTION_INSTANCE_DEFAULT } from "@/lib/chat/evolution.adapter";
import type { SomaPushConfig } from "@/lib/push/push.types";

/** Comunidade oficial Soma Promotora (instância soma-crm é admin/proprietária). */
export const SOMA_DEFAULT_COMMUNITY_INVITE_LINK =
  "https://chat.whatsapp.com/HOArsOldAKREFg23isS3ZT";

export function resolveDefaultPushCommunityEvoInstance(): string {
  const fromEnv = String(process.env.SOMA_PUSH_COMMUNITY_EVO_INSTANCE || "").trim();
  if (fromEnv) return fromEnv;
  const fromEvolution = String(process.env.EVOLUTION_INSTANCE || "").trim();
  if (fromEvolution) return fromEvolution;
  return SOMA_EVOLUTION_INSTANCE_DEFAULT;
}

export function resolvePushCommunityInviteLink(): string {
  const fromEnv = String(process.env.SOMA_PUSH_COMMUNITY_INVITE_LINK || "").trim();
  if (fromEnv.startsWith("https://chat.whatsapp.com/")) return fromEnv;
  return SOMA_DEFAULT_COMMUNITY_INVITE_LINK;
}

export function resolvePushCommunityAnnouncementJidEnv(): string {
  const fromEnv = String(process.env.SOMA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID || "").trim();
  return fromEnv.includes("@g.us") ? fromEnv : "";
}

export function buildDefaultPushConfig(): SomaPushConfig {
  return {
    communityInviteLink: resolvePushCommunityInviteLink(),
    communityAnnouncementGroupJid: resolvePushCommunityAnnouncementJidEnv(),
    communityEvoInstance: resolveDefaultPushCommunityEvoInstance(),
    updatedAt: new Date().toISOString(),
  };
}
