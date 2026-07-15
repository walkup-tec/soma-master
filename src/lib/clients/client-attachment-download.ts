const DOWNLOAD_TTL_MS = 5 * 60 * 1000;

type DownloadToken = {
  attachmentId: string;
  expiresAt: number;
};

const tokens = new Map<string, DownloadToken>();

export function issueClientAttachmentDownloadToken(attachmentId: string): string {
  const token = crypto.randomUUID();
  tokens.set(token, {
    attachmentId,
    expiresAt: Date.now() + DOWNLOAD_TTL_MS,
  });
  return token;
}

export function consumeClientAttachmentDownloadToken(token: string): string | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  tokens.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return entry.attachmentId;
}

export function clientAttachmentDownloadPath(token: string): string {
  return `/api/client-attachments/${token}/download`;
}
