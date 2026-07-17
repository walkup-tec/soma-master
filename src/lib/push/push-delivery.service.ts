import { isSmtpMailEnabled, sendSmtpMail } from "@/lib/mail/smtp.adapter";
import { getPartnerAccess } from "@/lib/partners/partner.repository";
import { sendPushToWhatsAppCommunity } from "@/lib/push/push-community.service";
import { sanitizeReviewedPushText } from "@/lib/push/push-openai.service";
import {
  createPushId,
  dismissPushForUser,
  getPushMessageById,
  listPushMessages,
  savePushMessage,
} from "@/lib/push/push.repository";
import type {
  SomaPushAlertView,
  SomaPushAudience,
  SomaPushDeliveryResults,
  SomaPushImageAttachment,
  SomaPushMessage,
  SomaPushUserRole,
} from "@/lib/push/push.types";
import { listAllUsers } from "@/lib/users/user.repository";
import type { SessionData } from "@/lib/auth/session-config";

const DEDUPE_WINDOW_MS = 90_000;
let preparePushChain: Promise<unknown> = Promise.resolve();
const pushInFlightFingerprints = new Set<string>();

function runPreparePushLocked<T>(fn: () => Promise<T> | T): Promise<T> {
  const next = preparePushChain.then(() => Promise.resolve().then(fn));
  preparePushChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function normalizeEmail(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function resolveDefaultUserRoles(userRoles: SomaPushUserRole[]): SomaPushUserRole[] {
  return userRoles?.length ? userRoles : (["master", "user"] as SomaPushUserRole[]);
}

async function resolveStaffRecipients(roles: SomaPushUserRole[]): Promise<string[]> {
  const allowed = new Set(resolveDefaultUserRoles(roles));
  const users = await listAllUsers();
  return users
    .filter((user) => allowed.has(user.role))
    .map((user) => normalizeEmail(user.email))
    .filter((email) => email.includes("@"));
}

async function resolvePartnerRecipients(): Promise<string[]> {
  const users = await listAllUsers();
  const emails: string[] = [];
  for (const user of users) {
    if (user.role === "master") continue;
    const access = await getPartnerAccess(user.id);
    if (access?.status === "active") {
      emails.push(normalizeEmail(user.email));
    }
  }
  return emails.filter((email) => email.includes("@"));
}

async function resolveEmailRecipients(
  audiences: SomaPushAudience[],
  userRoles: SomaPushUserRole[],
): Promise<string[]> {
  if (!audiences.includes("email")) return [];
  const emails = new Set<string>();
  const wantsPartners = audiences.includes("partners");
  const wantsUsers = audiences.includes("users");
  const broadcastEmailOnly = !wantsPartners && !wantsUsers;

  if (wantsPartners || broadcastEmailOnly) {
    for (const email of await resolvePartnerRecipients()) emails.add(email);
  }
  if (wantsUsers || broadcastEmailOnly) {
    for (const email of await resolveStaffRecipients(userRoles)) emails.add(email);
  }
  return Array.from(emails);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildPushEmailHtml(title: string, message: string): { subject: string; text: string; html: string } {
  const subject = String(title || "Comunicado Soma Promotora").trim() || "Comunicado Soma Promotora";
  const text = `${subject}\n\n${message}\n\n— Soma Promotora`;
  const html = `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Segoe UI,Arial,sans-serif;background:#f5f5f5;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e4e4e4;overflow:hidden;">
    <div style="background:#be1c6a;padding:18px 22px;color:#fff;font-weight:700;">Soma Promotora</div>
    <div style="padding:22px;color:#1a1a1a;line-height:1.6;">
      <h1 style="margin:0 0 12px;font-size:18px;">${escapeHtml(subject)}</h1>
      <p style="white-space:pre-wrap;margin:0;color:#374151;">${escapeHtml(message)}</p>
    </div>
  </div></body></html>`;
  return { subject, text, html };
}

async function deliverEmails(title: string, text: string, recipients: string[]) {
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let detail = "";

  if (!recipients.length) {
    return {
      sent: 0,
      skipped: 0,
      failed: 0,
      detail: "Nenhum destinatário de e-mail encontrado (usuários/parceiros).",
    };
  }

  if (!isSmtpMailEnabled()) {
    return {
      sent: 0,
      skipped: recipients.length,
      failed: recipients.length,
      detail: "SMTP desligado (MAIL_MODE diferente de smtp). E-mails não foram enviados.",
    };
  }

  const template = buildPushEmailHtml(title, text);
  // Sequencial: Gmail costuma rejeitar rajada paralela.
  for (const toEmail of recipients) {
    const normalized = normalizeEmail(toEmail);
    if (!normalized.includes("@")) {
      skipped += 1;
      continue;
    }
    try {
      await sendSmtpMail({
        to: normalized,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Falha SMTP.";
      console.error(`[push] falha e-mail para ${normalized}:`, message);
      if (!detail) detail = message;
    }
  }

  if (!detail) {
    detail =
      failed > 0
        ? `${sent} enviado(s), ${failed} falha(s), ${skipped} ignorado(s).`
        : `${sent} e-mail(s) enviado(s).`;
  }

  return { sent, skipped, failed, detail };
}

function validatePushInput(input: {
  title: string;
  audiences: SomaPushAudience[];
  reviewedText: string;
  image: SomaPushImageAttachment | null;
}) {
  const audiences = Array.from(
    new Set((input.audiences || []).filter((value): value is SomaPushAudience => !!value)),
  );
  if (!audiences.length) {
    throw new Error("Selecione ao menos um destino para o push.");
  }
  const hasNonCommunityAudience = audiences.some(
    (audience) => audience === "partners" || audience === "users" || audience === "email",
  );
  if (!input.reviewedText && !input.image) {
    throw new Error("Informe a mensagem ou uma imagem para o push.");
  }
  if (!input.reviewedText && hasNonCommunityAudience) {
    throw new Error(
      "Informe o texto para usuários, parceiros e e-mail. A imagem é enviada apenas à comunidade WhatsApp.",
    );
  }
  if (input.image && !audiences.includes("community")) {
    throw new Error("A imagem só pode ser enviada quando o destino Comunidade WhatsApp estiver marcado.");
  }
  if (audiences.includes("community") && !String(input.title || "").trim()) {
    throw new Error("Informe o título para publicar na comunidade WhatsApp.");
  }
  return audiences;
}

function buildPushFingerprint(input: {
  title: string;
  reviewedText: string;
  audiences: SomaPushAudience[];
  userRoles: SomaPushUserRole[];
  createdByEmail: string;
  image: SomaPushImageAttachment | null;
}): string {
  return [
    normalizeEmail(input.createdByEmail),
    String(input.title || "")
      .trim()
      .toLowerCase(),
    String(input.reviewedText || "").trim(),
    [...input.audiences].sort().join(","),
    [...input.userRoles].sort().join(","),
    String(input.image?.id || ""),
  ].join("||");
}

function findRecentDuplicate(input: {
  title: string;
  reviewedText: string;
  audiences: SomaPushAudience[];
  userRoles: SomaPushUserRole[];
  createdByEmail: string;
  image: SomaPushImageAttachment | null;
}): SomaPushMessage | null {
  const cutoff = Date.now() - DEDUPE_WINDOW_MS;
  const audienceKey = [...input.audiences].sort().join(",");
  const rolesKey = [...input.userRoles].sort().join(",");
  const imageId = String(input.image?.id || "");
  const titleKey = String(input.title || "")
    .trim()
    .toLowerCase();

  return (
    listPushMessages(20).find((row) => {
      if (normalizeEmail(row.createdByEmail) !== normalizeEmail(input.createdByEmail)) return false;
      if (new Date(row.createdAt).getTime() < cutoff) return false;
      if (
        String(row.title || "")
          .trim()
          .toLowerCase() !== titleKey
      )
        return false;
      if (row.reviewedText !== input.reviewedText) return false;
      if ([...row.audiences].sort().join(",") !== audienceKey) return false;
      if ([...row.userRoles].sort().join(",") !== rolesKey) return false;
      if (String(row.image?.id || "") !== imageId) return false;
      return row.status === "sent" || row.status === "partial" || row.status === "sending";
    }) ?? null
  );
}

type PreparedPushMessage = {
  deduplicated: boolean;
  message: SomaPushMessage;
  fingerprint?: string;
};

function preparePushMessage(input: {
  title: string;
  originalText: string;
  reviewedText: string;
  audiences: SomaPushAudience[];
  userRoles: SomaPushUserRole[];
  createdByEmail: string;
  image?: SomaPushImageAttachment | null;
}): PreparedPushMessage {
  const image = input.image?.id ? input.image : null;
  const pushTitle = String(input.title || "Comunicado").trim() || "Comunicado";
  const reviewedText = sanitizeReviewedPushText(
    String(input.reviewedText || input.originalText || "").trim(),
  );
  const audiences = validatePushInput({
    title: pushTitle,
    audiences: input.audiences,
    reviewedText,
    image,
  });
  const userRoles = input.userRoles || [];

  const fingerprint = buildPushFingerprint({
    title: pushTitle,
    reviewedText,
    audiences,
    userRoles,
    createdByEmail: input.createdByEmail,
    image,
  });

  if (pushInFlightFingerprints.has(fingerprint)) {
    const duplicate =
      findRecentDuplicate({
        title: pushTitle,
        reviewedText,
        audiences,
        userRoles,
        createdByEmail: input.createdByEmail,
        image,
      }) ?? null;
    if (duplicate) return { deduplicated: true, message: duplicate };
  }

  const duplicate = findRecentDuplicate({
    title: pushTitle,
    reviewedText,
    audiences,
    userRoles,
    createdByEmail: input.createdByEmail,
    image,
  });
  if (duplicate) {
    return { deduplicated: true, message: duplicate };
  }

  pushInFlightFingerprints.add(fingerprint);
  const now = new Date().toISOString();
  const pendingMessage: SomaPushMessage = {
    id: createPushId(),
    title: pushTitle,
    originalText: String(input.originalText || "").trim(),
    reviewedText,
    image,
    audiences,
    userRoles,
    status: "sending",
    createdByEmail: normalizeEmail(input.createdByEmail),
    createdAt: now,
    sentAt: now,
    deliveryResults: {},
    dismissedBy: [],
  };
  savePushMessage(pendingMessage);
  return { deduplicated: false, message: pendingMessage, fingerprint };
}

async function deliverPreparedPushMessage(messageId: string, fingerprint: string): Promise<void> {
  try {
    const current = getPushMessageById(messageId);
    if (!current || current.status !== "sending") return;

    const deliveryResults: SomaPushDeliveryResults = {};
    let hasFailure = false;
    const audiences = current.audiences;
    const userRoles = current.userRoles || [];

    if (audiences.includes("users")) {
      const roles = resolveDefaultUserRoles(userRoles);
      deliveryResults.users = {
        targeted: (await resolveStaffRecipients(roles)).length,
        roles,
      };
    }
    if (audiences.includes("partners")) {
      deliveryResults.partners = { targeted: (await resolvePartnerRecipients()).length };
    }

    const parallelTasks: Promise<void>[] = [];
    if (audiences.includes("community")) {
      parallelTasks.push(
        sendPushToWhatsAppCommunity(current.title, current.reviewedText, current.image).then(
          (community) => {
            deliveryResults.community = {
              ok: community.ok,
              detail: community.detail,
              groupJid: community.groupJid,
            };
            if (!community.ok) hasFailure = true;
          },
        ),
      );
    }
    if (audiences.includes("email")) {
      const recipients = await resolveEmailRecipients(audiences, userRoles);
      parallelTasks.push(
        deliverEmails(current.title, current.reviewedText, recipients).then((email) => {
          deliveryResults.email = email;
          if (email.failed > 0 || email.sent === 0) hasFailure = true;
        }),
      );
    }
    if (parallelTasks.length) await Promise.all(parallelTasks);

    savePushMessage({
      ...current,
      status: hasFailure ? "partial" : "sent",
      sentAt: current.sentAt || new Date().toISOString(),
      deliveryResults,
    });
  } catch (error) {
    const current = getPushMessageById(messageId);
    if (current) {
      savePushMessage({
        ...current,
        status: "failed",
        sentAt: current.sentAt || new Date().toISOString(),
        deliveryResults: {
          ...(current.deliveryResults || {}),
          community: {
            ok: false,
            detail: error instanceof Error ? error.message : "Falha inesperada no envio do push.",
          },
        },
      });
    }
    console.error(`[push] falha ao entregar push ${messageId}:`, error);
  } finally {
    pushInFlightFingerprints.delete(fingerprint);
  }
}

export type SendPushMessageResult = {
  message: SomaPushMessage;
  deduplicated: boolean;
  accepted?: boolean;
  fingerprint?: string;
};

export async function acceptPushMessage(input: {
  title: string;
  originalText: string;
  reviewedText: string;
  audiences: SomaPushAudience[];
  userRoles: SomaPushUserRole[];
  createdByEmail: string;
  image?: SomaPushImageAttachment | null;
}): Promise<SendPushMessageResult> {
  return runPreparePushLocked(async () => {
    const prepared = preparePushMessage(input);
    if (prepared.deduplicated) {
      return { message: prepared.message, deduplicated: true };
    }
    return {
      message: prepared.message,
      deduplicated: false,
      accepted: true,
      fingerprint: String(prepared.fingerprint || ""),
    };
  });
}

export function deliverPushMessageById(messageId: string, fingerprint: string): void {
  void deliverPreparedPushMessage(messageId, fingerprint);
}

export async function sendPushMessage(input: {
  title: string;
  originalText: string;
  reviewedText: string;
  audiences: SomaPushAudience[];
  userRoles: SomaPushUserRole[];
  createdByEmail: string;
  image?: SomaPushImageAttachment | null;
}): Promise<SendPushMessageResult> {
  const accepted = await acceptPushMessage(input);
  if (accepted.deduplicated || !accepted.fingerprint) {
    return accepted;
  }
  await deliverPreparedPushMessage(accepted.message.id, accepted.fingerprint);
  const finalMessage = getPushMessageById(accepted.message.id) || accepted.message;
  return { message: finalMessage, deduplicated: false };
}

export async function listPushAlertsForSession(
  session: SessionData,
): Promise<SomaPushAlertView[]> {
  const email = normalizeEmail(session.email);
  if (!email.includes("@")) return [];

  const partnerAccess = await getPartnerAccess(session.userId);
  const isPartner = Boolean(partnerAccess && partnerAccess.status === "active");
  const isStaff = session.role === "master" || session.role === "user";
  if (!isPartner && !isStaff) return [];

  return listPushMessages(100)
    .filter((row) => row.status === "sent" || row.status === "partial")
    .filter((row) => {
      const dismissed = new Set((row.dismissedBy || []).map(normalizeEmail));
      if (dismissed.has(email)) return false;
      if (isPartner && row.audiences.includes("partners")) return true;
      if (!row.audiences.includes("users")) return false;
      const roles = resolveDefaultUserRoles(row.userRoles || []);
      return roles.includes(session.role);
    })
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      title: row.title,
      message: row.reviewedText,
      sentAt: row.sentAt || row.createdAt,
      imageUrl: row.image?.id ? `/api/push/media/${row.image.id}` : null,
    }));
}

export function dismissPushAlert(pushId: string, email: string): boolean {
  return dismissPushForUser(pushId, email);
}

export function listPushHistory(limit = 30): SomaPushMessage[] {
  return listPushMessages(limit).map((row) => ({
    ...row,
    image: row.image?.id ? row.image : null,
  }));
}

export { getPushMessageById };
