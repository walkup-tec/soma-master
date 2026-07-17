/** Tipos do módulo Push / Comunicados (Soma). */

export type SomaPushAudience = "users" | "partners" | "community" | "email";

/** Papéis de usuário interno alvo do sininho. */
export type SomaPushUserRole = "master" | "user";

export type SomaPushImageAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type SomaPushStatus = "draft" | "sending" | "sent" | "partial" | "failed";

export type SomaPushDeliveryResults = {
  users?: { targeted: number; roles: SomaPushUserRole[] };
  partners?: { targeted: number };
  community?: { ok: boolean; detail: string; groupJid?: string };
  email?: { sent: number; skipped: number; failed: number };
};

export type SomaPushMessage = {
  id: string;
  title: string;
  originalText: string;
  reviewedText: string;
  image: SomaPushImageAttachment | null;
  audiences: SomaPushAudience[];
  userRoles: SomaPushUserRole[];
  status: SomaPushStatus;
  createdByEmail: string;
  createdAt: string;
  sentAt: string | null;
  deliveryResults: SomaPushDeliveryResults | null;
  dismissedBy: string[];
};

export type SomaPushConfig = {
  communityInviteLink: string;
  communityAnnouncementGroupJid: string;
  communityEvoInstance: string;
  updatedAt: string;
};

export type SomaPushAlertView = {
  id: string;
  title: string;
  message: string;
  sentAt: string;
  imageUrl?: string | null;
};
