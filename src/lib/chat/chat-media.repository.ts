import { createReadStream } from "node:fs";
import { mkdir, open, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import {
  CHAT_IMAGE_CHUNK_BYTES,
  CHAT_IMAGE_MAX_BYTES,
} from "@/lib/chat/chat-media.constants";
import { ensureChatSchema } from "@/lib/chat/ensure-chat-schema";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";

const CHAT_MEDIA_DIR = join(process.cwd(), "data", "chat-media");
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ChatImageUploadMeta = {
  mediaId: string;
  conversationId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  receivedChunks: number;
  userId: string;
  userName: string;
  createdAt: string;
};

type ChatMediaRow = {
  id: string;
  conversation_id: string;
  file_name: string;
  file_size: string;
  mime_type: string;
  total_chunks: number;
  received_chunks: number;
  user_id: string;
  user_name: string;
  created_at: Date;
};

function mapMediaRow(row: ChatMediaRow): ChatImageUploadMeta {
  return {
    mediaId: row.id,
    conversationId: row.conversation_id,
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    mimeType: row.mime_type,
    totalChunks: row.total_chunks,
    receivedChunks: row.received_chunks,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at.toISOString(),
  };
}

async function getChatSql() {
  const sql = await getSql();
  await ensureChatSchema(sql);
  return sql;
}

function assertMediaId(mediaId: string): void {
  if (!/^chatimg-[a-z0-9-]{8,40}$/i.test(mediaId)) {
    throw new Error("Identificador de imagem inválido.");
  }
}

function mediaDir(mediaId: string) {
  assertMediaId(mediaId);
  return join(CHAT_MEDIA_DIR, mediaId);
}

function metaPath(mediaId: string) {
  return join(mediaDir(mediaId), "meta.json");
}

function storedFilePath(mediaId: string) {
  return join(mediaDir(mediaId), "image.bin");
}

function chunkPath(mediaId: string, index: number) {
  return join(mediaDir(mediaId), `chunk-${index}.bin`);
}

function validateImage(fileSize: number, mimeType: string): void {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("Formato não permitido. Use JPG, PNG ou WEBP.");
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > CHAT_IMAGE_MAX_BYTES) {
    throw new Error("A imagem deve ter no máximo 10 MB.");
  }
}

export async function initChatImageUpload(input: {
  conversationId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  userId: string;
  userName: string;
}): Promise<ChatImageUploadMeta> {
  validateImage(input.fileSize, input.mimeType);
  const expectedChunks = Math.ceil(input.fileSize / CHAT_IMAGE_CHUNK_BYTES);
  if (input.totalChunks !== expectedChunks || input.totalChunks < 1 || input.totalChunks > 10) {
    throw new Error("Quantidade de partes da imagem inválida.");
  }

  const mediaId = `chatimg-${crypto.randomUUID().slice(0, 12)}`;
  await mkdir(mediaDir(mediaId), { recursive: true });
  const meta: ChatImageUploadMeta = {
    mediaId,
    conversationId: input.conversationId,
    fileName: input.fileName.slice(0, 160) || "imagem",
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    totalChunks: input.totalChunks,
    receivedChunks: 0,
    userId: input.userId,
    userName: input.userName,
    createdAt: new Date().toISOString(),
  };
  await writeFile(metaPath(mediaId), JSON.stringify(meta, null, 2), "utf8");
  if (isDatabaseEnabled()) {
    const sql = await getChatSql();
    await sql`
      insert into crm.chat_media (
        id, conversation_id, file_name, file_size, mime_type, total_chunks,
        received_chunks, user_id, user_name, created_at
      ) values (
        ${meta.mediaId}, ${meta.conversationId}, ${meta.fileName}, ${meta.fileSize},
        ${meta.mimeType}, ${meta.totalChunks}, 0, ${meta.userId}, ${meta.userName},
        ${new Date(meta.createdAt)}
      )
    `;
  }
  return meta;
}

export async function getChatImageUploadMeta(mediaId: string): Promise<ChatImageUploadMeta | null> {
  if (isDatabaseEnabled()) {
    const sql = await getChatSql();
    const rows = await sql<ChatMediaRow[]>`
      select id, conversation_id, file_name, file_size, mime_type, total_chunks,
             received_chunks, user_id, user_name, created_at
      from crm.chat_media where id = ${mediaId} limit 1
    `;
    if (rows[0]) return mapMediaRow(rows[0]);
  }
  try {
    const raw = await readFile(metaPath(mediaId), "utf8");
    return JSON.parse(raw) as ChatImageUploadMeta;
  } catch {
    return null;
  }
}

export async function appendChatImageChunk(
  mediaId: string,
  chunkIndex: number,
  chunkBase64: string,
): Promise<ChatImageUploadMeta> {
  const meta = await getChatImageUploadMeta(mediaId);
  if (!meta) throw new Error("Upload da imagem não encontrado.");
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= meta.totalChunks) {
    throw new Error("Parte da imagem inválida.");
  }

  const buffer = Buffer.from(chunkBase64, "base64");
  if (buffer.length === 0 || buffer.length > CHAT_IMAGE_CHUNK_BYTES) {
    throw new Error("Parte da imagem vazia ou acima do limite.");
  }
  await writeFile(chunkPath(mediaId, chunkIndex), buffer);

  const received = new Set<number>();
  for (const name of await readdir(mediaDir(mediaId))) {
    const match = name.match(/^chunk-(\d+)\.bin$/);
    if (match) received.add(Number(match[1]));
  }
  meta.receivedChunks = received.size;
  await writeFile(metaPath(mediaId), JSON.stringify(meta, null, 2), "utf8");
  if (isDatabaseEnabled()) {
    const sql = await getChatSql();
    await sql`
      update crm.chat_media
      set received_chunks = ${meta.receivedChunks}
      where id = ${mediaId}
    `;
  }
  return meta;
}

export async function finalizeChatImageUpload(mediaId: string): Promise<ChatImageUploadMeta> {
  const meta = await getChatImageUploadMeta(mediaId);
  if (!meta) throw new Error("Upload da imagem não encontrado.");
  if (meta.receivedChunks !== meta.totalChunks) {
    throw new Error(`Upload incompleto (${meta.receivedChunks}/${meta.totalChunks} partes).`);
  }

  const target = storedFilePath(mediaId);
  const output = await open(target, "w");
  try {
    for (let index = 0; index < meta.totalChunks; index += 1) {
      const part = await readFile(chunkPath(mediaId, index));
      await output.write(part);
      await rm(chunkPath(mediaId, index), { force: true });
    }
  } finally {
    await output.close();
  }

  const size = (await stat(target)).size;
  if (size !== meta.fileSize) {
    await rm(mediaDir(mediaId), { recursive: true, force: true });
    if (isDatabaseEnabled()) {
      const sql = await getChatSql();
      await sql`delete from crm.chat_media where id = ${mediaId}`;
    }
    throw new Error("Imagem incompleta após o upload. Tente novamente.");
  }
  if (isDatabaseEnabled()) {
    const content = await readFile(target);
    const sql = await getChatSql();
    await sql`
      update crm.chat_media
      set content = ${content}, received_chunks = ${meta.totalChunks}
      where id = ${mediaId}
    `;
  }
  return meta;
}

export async function saveInboundChatImage(input: {
  base64: string;
  mimeType: string;
  fileName?: string | null;
  conversationId: string;
}): Promise<ChatImageUploadMeta> {
  const normalizedBase64 = input.base64.replace(/^data:[^;]+;base64,/i, "");
  const buffer = Buffer.from(normalizedBase64, "base64");
  validateImage(buffer.length, input.mimeType);
  const mediaId = `chatimg-${crypto.randomUUID().slice(0, 12)}`;
  await mkdir(mediaDir(mediaId), { recursive: true });
  await writeFile(storedFilePath(mediaId), buffer);
  const meta: ChatImageUploadMeta = {
    mediaId,
    conversationId: input.conversationId,
    fileName: (input.fileName ?? "imagem-recebida").slice(0, 160),
    fileSize: buffer.length,
    mimeType: input.mimeType,
    totalChunks: 1,
    receivedChunks: 1,
    userId: "whatsapp-contact",
    userName: "Contato",
    createdAt: new Date().toISOString(),
  };
  await writeFile(metaPath(mediaId), JSON.stringify(meta, null, 2), "utf8");
  if (isDatabaseEnabled()) {
    const sql = await getChatSql();
    await sql`
      insert into crm.chat_media (
        id, conversation_id, file_name, file_size, mime_type, total_chunks,
        received_chunks, user_id, user_name, content, created_at
      ) values (
        ${meta.mediaId}, ${meta.conversationId}, ${meta.fileName}, ${meta.fileSize},
        ${meta.mimeType}, 1, 1, ${meta.userId}, ${meta.userName}, ${buffer},
        ${new Date(meta.createdAt)}
      )
    `;
  }
  return meta;
}

export async function readChatImageAsDataUrl(mediaId: string): Promise<{
  meta: ChatImageUploadMeta;
  dataUrl: string;
}> {
  const meta = await getChatImageUploadMeta(mediaId);
  if (!meta) throw new Error("Imagem não encontrada.");
  if (isDatabaseEnabled()) {
    const sql = await getChatSql();
    const rows = await sql<{ content: Buffer | null }[]>`
      select content from crm.chat_media where id = ${mediaId} limit 1
    `;
    if (rows[0]?.content) {
      return {
        meta,
        dataUrl: `data:${meta.mimeType};base64,${rows[0].content.toString("base64")}`,
      };
    }
  }
  const file = await readFile(storedFilePath(mediaId));
  return { meta, dataUrl: `data:${meta.mimeType};base64,${file.toString("base64")}` };
}

export async function openChatImageReadStream(mediaId: string) {
  const meta = await getChatImageUploadMeta(mediaId);
  if (!meta) throw new Error("Imagem não encontrada.");
  if (isDatabaseEnabled()) {
    const sql = await getChatSql();
    const rows = await sql<{ content: Buffer | null }[]>`
      select content from crm.chat_media where id = ${mediaId} limit 1
    `;
    if (rows[0]?.content) {
      return { meta, stream: Readable.from([rows[0].content]) };
    }
  }
  return { meta, stream: createReadStream(storedFilePath(mediaId)) };
}

export function chatImageStreamToWeb(stream: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}
