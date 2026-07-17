import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { randomUUID } from "node:crypto";
import type { SomaPushImageAttachment } from "@/lib/push/push.types";

const PUSH_MEDIA_DIR = join(process.cwd(), "data", "push-media");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function ensureDir(): void {
  if (!existsSync(PUSH_MEDIA_DIR)) mkdirSync(PUSH_MEDIA_DIR, { recursive: true });
}

function sanitizeFileName(value: string): string {
  const base = basename(String(value || "imagem").trim()) || "imagem";
  return base.replace(/[^\w.\-()+\s]/g, "_").slice(0, 120);
}

function isSafeMediaId(id: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(String(id || "").trim());
}

export function savePushImageAttachment(input: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): SomaPushImageAttachment {
  const mimeType = String(input.mimeType || "")
    .trim()
    .toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error("Formato inválido. Use JPEG, PNG, WebP ou GIF.");
  }
  if (!input.buffer?.length || input.buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Imagem inválida ou maior que 5 MB.");
  }

  ensureDir();
  const id = randomUUID();
  const safeName = sanitizeFileName(input.fileName);
  const storageName = `${id}-${safeName}`;
  writeFileSync(join(PUSH_MEDIA_DIR, storageName), input.buffer);

  return {
    id,
    fileName: safeName,
    mimeType,
    sizeBytes: input.buffer.length,
  };
}

export function resolvePushMediaFile(
  mediaId: string,
): { absolutePath: string; mimeType: string; fileName: string } | null {
  const id = String(mediaId || "").trim();
  if (!isSafeMediaId(id)) return null;
  ensureDir();
  const entries = readdirSync(PUSH_MEDIA_DIR).filter((name) => name.startsWith(`${id}-`));
  const match = entries[0];
  if (!match) return null;
  const absolutePath = join(PUSH_MEDIA_DIR, match);
  if (!existsSync(absolutePath)) return null;
  const ext = extname(match).toLowerCase();
  const mimeType =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
          ? "image/gif"
          : "image/jpeg";
  return { absolutePath, mimeType, fileName: match.slice(id.length + 1) };
}

export function readPushMediaBase64(mediaId: string): { base64: string; mimeType: string } | null {
  const file = resolvePushMediaFile(mediaId);
  if (!file) return null;
  return {
    base64: readFileSync(file.absolutePath).toString("base64"),
    mimeType: file.mimeType,
  };
}
