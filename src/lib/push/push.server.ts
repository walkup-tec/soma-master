import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionConfig, type SessionData } from "@/lib/auth/session-config";
import {
  loadPushCommunityConfigForAdmin,
  updatePushCommunityConfig,
} from "@/lib/push/push-community.service";
import {
  acceptPushMessage,
  deliverPushMessageById,
  dismissPushAlert,
  listPushAlertsForSession,
  listPushHistory,
  sendPushMessage,
} from "@/lib/push/push-delivery.service";
import { savePushImageAttachment } from "@/lib/push/push-media.service";
import { reviewPushMessageWithOpenAi } from "@/lib/push/push-openai.service";
import type {
  SomaPushAudience,
  SomaPushImageAttachment,
  SomaPushUserRole,
} from "@/lib/push/push.types";

async function requireSession(): Promise<SessionData> {
  const session = await getSession<SessionData>(sessionConfig);
  const user = session.data;
  if (!user?.userId || !user.email) {
    throw new Error("Não autenticado.");
  }
  return user as SessionData;
}

async function requireMaster(): Promise<SessionData> {
  const user = await requireSession();
  if (user.role !== "master") {
    throw new Error("Apenas usuários master podem gerenciar Push.");
  }
  return user;
}

function parseAudiences(raw: unknown): SomaPushAudience[] {
  const allowed = new Set<SomaPushAudience>(["users", "partners", "community", "email"]);
  const values = Array.isArray(raw) ? raw : [];
  return values
    .map((value) => String(value || "").trim() as SomaPushAudience)
    .filter((value) => allowed.has(value));
}

function parseUserRoles(raw: unknown): SomaPushUserRole[] {
  const allowed = new Set<SomaPushUserRole>(["master", "user"]);
  const values = Array.isArray(raw) ? raw : [];
  return values
    .map((value) => String(value || "").trim() as SomaPushUserRole)
    .filter((value) => allowed.has(value));
}

function parseImage(raw: unknown): SomaPushImageAttachment | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<SomaPushImageAttachment>;
  if (!value.id) return null;
  return {
    id: String(value.id),
    fileName: String(value.fileName || "imagem"),
    mimeType: String(value.mimeType || "image/jpeg"),
    sizeBytes: Number(value.sizeBytes) || 0,
  };
}

export const listPushAlertsFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireSession();
  return listPushAlertsForSession(session);
});

export const dismissPushAlertFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
    const pushId = String((data as { pushId?: string }).pushId || "").trim();
    if (!pushId) throw new Error("Comunicado inválido.");
    return { pushId };
  })
  .handler(async ({ data }) => {
    const session = await requireSession();
    const ok = dismissPushAlert(data.pushId, session.email);
    return { ok };
  });

export const listPushHistoryFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireMaster();
  return listPushHistory(40);
});

export const getPushCommunityConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireMaster();
  return loadPushCommunityConfigForAdmin();
});

export const updatePushCommunityConfigFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
    const value = data as Record<string, unknown>;
    return {
      communityInviteLink:
        typeof value.communityInviteLink === "string" ? value.communityInviteLink : undefined,
      communityAnnouncementGroupJid:
        typeof value.communityAnnouncementGroupJid === "string"
          ? value.communityAnnouncementGroupJid
          : undefined,
      communityEvoInstance:
        typeof value.communityEvoInstance === "string" ? value.communityEvoInstance : undefined,
    };
  })
  .handler(async ({ data }) => {
    await requireMaster();
    return updatePushCommunityConfig(data);
  });

export const reviewPushMessageFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
    const value = data as { title?: string; text?: string };
    return {
      title: String(value.title || "").trim(),
      text: String(value.text || "").trim(),
    };
  })
  .handler(async ({ data }) => {
    await requireMaster();
    return reviewPushMessageWithOpenAi(data);
  });

export const uploadPushImageFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
    const value = data as {
      fileName?: string;
      mimeType?: string;
      base64?: string;
    };
    const fileName = String(value.fileName || "").trim();
    const mimeType = String(value.mimeType || "").trim();
    const base64 = String(value.base64 || "").trim();
    if (!fileName || !mimeType || !base64) {
      throw new Error("Arquivo de imagem inválido.");
    }
    return { fileName, mimeType, base64 };
  })
  .handler(async ({ data }) => {
    await requireMaster();
    const buffer = Buffer.from(data.base64, "base64");
    return savePushImageAttachment({
      buffer,
      fileName: data.fileName,
      mimeType: data.mimeType,
    });
  });

export const sendPushMessageFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
    const value = data as Record<string, unknown>;
    return {
      title: String(value.title || "").trim(),
      originalText: String(value.originalText || "").trim(),
      reviewedText: String(value.reviewedText || "").trim(),
      audiences: parseAudiences(value.audiences),
      userRoles: parseUserRoles(value.userRoles),
      image: parseImage(value.image),
      waitForDelivery: value.waitForDelivery === true,
    };
  })
  .handler(async ({ data }) => {
    const master = await requireMaster();
    const payload = {
      title: data.title || "Comunicado Soma Promotora",
      originalText: data.originalText,
      reviewedText: data.reviewedText || data.originalText,
      audiences: data.audiences,
      userRoles: data.userRoles,
      createdByEmail: master.email,
      image: data.image,
    };

    if (data.waitForDelivery) {
      return sendPushMessage(payload);
    }

    const accepted = await acceptPushMessage(payload);
    if (!accepted.deduplicated && accepted.fingerprint) {
      deliverPushMessageById(accepted.message.id, accepted.fingerprint);
    }
    return accepted;
  });
