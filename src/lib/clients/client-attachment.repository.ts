import { existsSync } from "node:fs";
import { createReadStream } from "node:fs";
import { mkdir, open, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { ClientAttachmentRecord } from "@/lib/clients/client.types";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";
import { ensureClientListIndexes } from "@/lib/db/ensure-client-indexes";

const ATTACHMENTS_DIR = join(process.cwd(), "data", "client-attachments");
const ATTACHMENTS_INDEX_FILE = join(process.cwd(), "data", "client-attachments-index.json");

export type ClientAttachmentUploadMeta = {
  attachmentId: string;
  clientId: string;
  fileName: string;
  fileSize: number;
  mimeType: string | null;
  totalChunks: number;
  receivedChunks: number;
  userId: string;
  userName: string;
  createdAt: string;
};

type AttachmentRow = {
  id: string;
  client_id: string;
  user_id: string;
  user_name: string;
  file_name: string;
  file_size: string;
  mime_type: string | null;
  storage_path: string;
  source_chat_media_id?: string | null;
  created_at: Date;
};

function attachmentDir(attachmentId: string) {
  return join(ATTACHMENTS_DIR, attachmentId);
}

function metaPath(attachmentId: string) {
  return join(attachmentDir(attachmentId), "meta.json");
}

function storedFilePath(attachmentId: string) {
  return join(attachmentDir(attachmentId), "file.bin");
}

function chunkPath(attachmentId: string, index: number) {
  return join(attachmentDir(attachmentId), `chunk-${index}.bin`);
}

function mapAttachmentRow(row: AttachmentRow): ClientAttachmentRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    userId: row.user_id,
    userName: row.user_name,
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    mimeType: row.mime_type,
    sourceChatMediaId: row.source_chat_media_id ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

async function readAttachmentsIndex(): Promise<ClientAttachmentRecord[]> {
  try {
    const raw = await readFile(ATTACHMENTS_INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw) as ClientAttachmentRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAttachmentsIndex(records: ClientAttachmentRecord[]): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(ATTACHMENTS_INDEX_FILE, JSON.stringify(records, null, 2), "utf8");
}

async function syncAttachmentToPostgres(
  record: ClientAttachmentRecord,
  storagePath: string,
): Promise<void> {
  if (!isDatabaseEnabled()) return;
  const sql = await getSql();
  await ensureClientListIndexes(sql);
  await sql`
    insert into crm.client_attachments (
      id, client_id, user_id, user_name, file_name, file_size, mime_type, storage_path,
      source_chat_media_id, created_at
    ) values (
      ${record.id},
      ${record.clientId},
      ${record.userId},
      ${record.userName},
      ${record.fileName},
      ${record.fileSize},
      ${record.mimeType},
      ${storagePath},
      ${record.sourceChatMediaId ?? null},
      ${record.createdAt}
    )
    on conflict do nothing
  `;
}

export async function listClientAttachments(clientId: string): Promise<ClientAttachmentRecord[]> {
  if (isDatabaseEnabled()) {
    const sql = await getSql();
    const rows = await sql<AttachmentRow[]>`
      select id, client_id, user_id, user_name, file_name, file_size, mime_type, storage_path, created_at
      from crm.client_attachments
      where client_id = ${clientId}
      order by created_at desc
    `;
    return rows.map(mapAttachmentRow);
  }

  const records = await readAttachmentsIndex();
  return records
    .filter((record) => record.clientId === clientId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function initClientAttachmentUpload(input: {
  clientId: string;
  fileName: string;
  fileSize: number;
  mimeType: string | null;
  totalChunks: number;
  userId: string;
  userName: string;
}): Promise<ClientAttachmentUploadMeta> {
  const attachmentId = `attfile-${crypto.randomUUID().slice(0, 12)}`;
  await mkdir(attachmentDir(attachmentId), { recursive: true });

  const meta: ClientAttachmentUploadMeta = {
    attachmentId,
    clientId: input.clientId,
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    totalChunks: input.totalChunks,
    receivedChunks: 0,
    userId: input.userId,
    userName: input.userName,
    createdAt: new Date().toISOString(),
  };

  await writeFile(metaPath(attachmentId), JSON.stringify(meta, null, 2), "utf8");
  return meta;
}

export async function createClientAttachmentFromChatMedia(input: {
  clientId: string;
  sourceChatMediaId: string;
  fileName: string;
  mimeType: string;
  content: Buffer;
  userId: string;
  userName: string;
}): Promise<{ attachment: ClientAttachmentRecord; created: boolean }> {
  if (!input.clientId.trim() || !input.sourceChatMediaId.trim()) {
    throw new Error("Cliente ou mídia inválidos.");
  }
  if (input.content.length === 0) throw new Error("A mídia recebida está vazia.");

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    await ensureClientListIndexes(sql);
    const existing = await sql<AttachmentRow[]>`
      select id, client_id, user_id, user_name, file_name, file_size, mime_type,
             storage_path, source_chat_media_id, created_at
      from crm.client_attachments
      where client_id = ${input.clientId}
        and source_chat_media_id = ${input.sourceChatMediaId}
      limit 1
    `;
    if (existing[0]) return { attachment: mapAttachmentRow(existing[0]), created: false };
  } else {
    const existing = (await readAttachmentsIndex()).find(
      (record) =>
        record.clientId === input.clientId &&
        record.sourceChatMediaId === input.sourceChatMediaId,
    );
    if (existing) return { attachment: existing, created: false };
  }

  const attachmentId = `attfile-${crypto.randomUUID().slice(0, 12)}`;
  const fileName = input.fileName.trim().slice(0, 160) || "midia-whatsapp";
  const createdAt = new Date().toISOString();
  const record: ClientAttachmentRecord = {
    id: attachmentId,
    clientId: input.clientId,
    userId: input.userId,
    userName: input.userName,
    fileName,
    fileSize: input.content.length,
    mimeType: input.mimeType,
    sourceChatMediaId: input.sourceChatMediaId,
    createdAt,
  };

  await mkdir(attachmentDir(attachmentId), { recursive: true });
  await writeFile(storedFilePath(attachmentId), input.content);
  await writeFile(
    metaPath(attachmentId),
    JSON.stringify(
      {
        attachmentId,
        clientId: input.clientId,
        fileName,
        fileSize: input.content.length,
        mimeType: input.mimeType,
        totalChunks: 1,
        receivedChunks: 1,
        userId: input.userId,
        userName: input.userName,
        createdAt,
      } satisfies ClientAttachmentUploadMeta,
      null,
      2,
    ),
    "utf8",
  );

  if (isDatabaseEnabled()) {
    await syncAttachmentToPostgres(record, storedFilePath(attachmentId));
    const sql = await getSql();
    const stored = await sql<AttachmentRow[]>`
      select id, client_id, user_id, user_name, file_name, file_size, mime_type,
             storage_path, source_chat_media_id, created_at
      from crm.client_attachments
      where client_id = ${input.clientId}
        and source_chat_media_id = ${input.sourceChatMediaId}
      limit 1
    `;
    if (stored[0] && stored[0].id !== attachmentId) {
      await rm(attachmentDir(attachmentId), { recursive: true, force: true });
      return { attachment: mapAttachmentRow(stored[0]), created: false };
    }
  } else {
    const existing = await readAttachmentsIndex();
    await writeAttachmentsIndex([record, ...existing]);
  }

  return { attachment: record, created: true };
}

export async function getClientAttachmentUploadMeta(
  attachmentId: string,
): Promise<ClientAttachmentUploadMeta | null> {
  try {
    const raw = await readFile(metaPath(attachmentId), "utf8");
    return JSON.parse(raw) as ClientAttachmentUploadMeta;
  } catch {
    return null;
  }
}

export async function appendClientAttachmentChunk(
  attachmentId: string,
  chunkIndex: number,
  chunkBase64: string,
): Promise<ClientAttachmentUploadMeta> {
  const meta = await getClientAttachmentUploadMeta(attachmentId);
  if (!meta) throw new Error("Envio de anexo não encontrado.");

  if (chunkIndex < 0 || chunkIndex >= meta.totalChunks) {
    throw new Error("Parte do arquivo inválida.");
  }

  const buffer = Buffer.from(chunkBase64, "base64");
  if (buffer.length === 0) {
    throw new Error(`Parte ${chunkIndex + 1} chegou vazia.`);
  }

  await writeFile(chunkPath(attachmentId, chunkIndex), buffer);

  const received = new Set<number>();
  const files = await readdir(attachmentDir(attachmentId));
  for (const name of files) {
    const match = name.match(/^chunk-(\d+)\.bin$/);
    if (match) received.add(Number(match[1]));
  }

  meta.receivedChunks = received.size;
  await writeFile(metaPath(attachmentId), JSON.stringify(meta, null, 2), "utf8");
  return meta;
}

export async function finalizeClientAttachmentUpload(attachmentId: string): Promise<ClientAttachmentRecord> {
  const meta = await getClientAttachmentUploadMeta(attachmentId);
  if (!meta) throw new Error("Envio de anexo não encontrado.");
  if (meta.receivedChunks !== meta.totalChunks) {
    throw new Error(`Envio incompleto (${meta.receivedChunks}/${meta.totalChunks} partes).`);
  }

  const target = storedFilePath(attachmentId);
  const output = await open(target, "w");
  try {
    for (let index = 0; index < meta.totalChunks; index += 1) {
      const part = await readFile(chunkPath(attachmentId, index));
      await output.write(part);
      await rm(chunkPath(attachmentId, index), { force: true });
    }
  } finally {
    await output.close();
  }

  const size = (await stat(target)).size;
  if (size !== meta.fileSize) {
    throw new Error("Arquivo incompleto após o envio. Tente novamente.");
  }

  const record: ClientAttachmentRecord = {
    id: meta.attachmentId,
    clientId: meta.clientId,
    userId: meta.userId,
    userName: meta.userName,
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    mimeType: meta.mimeType,
    createdAt: meta.createdAt,
  };

  if (isDatabaseEnabled()) {
    await syncAttachmentToPostgres(record, target);
  } else {
    const existing = await readAttachmentsIndex();
    await writeAttachmentsIndex([record, ...existing]);
  }

  return record;
}

export async function getClientAttachmentRecord(attachmentId: string): Promise<ClientAttachmentRecord | null> {
  if (isDatabaseEnabled()) {
    const sql = await getSql();
    const rows = await sql<AttachmentRow[]>`
      select id, client_id, user_id, user_name, file_name, file_size, mime_type, storage_path, created_at
      from crm.client_attachments
      where id = ${attachmentId}
      limit 1
    `;
    return rows[0] ? mapAttachmentRow(rows[0]) : null;
  }

  const records = await readAttachmentsIndex();
  return records.find((record) => record.id === attachmentId) ?? null;
}

export async function getClientAttachmentStoragePath(attachmentId: string): Promise<string> {
  if (isDatabaseEnabled()) {
    const sql = await getSql();
    const rows = await sql<{ storage_path: string }[]>`
      select storage_path from crm.client_attachments where id = ${attachmentId} limit 1
    `;
    const path = rows[0]?.storage_path;
    if (path && existsSync(path)) return path;
  }

  const path = storedFilePath(attachmentId);
  if (!existsSync(path)) {
    await finalizeClientAttachmentUpload(attachmentId).catch(() => undefined);
  }
  if (!existsSync(path)) {
    throw new Error("Arquivo do anexo não encontrado.");
  }
  return path;
}

export async function openClientAttachmentReadStream(attachmentId: string) {
  const record = await getClientAttachmentRecord(attachmentId);
  if (!record) throw new Error("Anexo não encontrado.");
  const path = await getClientAttachmentStoragePath(attachmentId);
  return {
    record,
    stream: createReadStream(path),
  };
}

export async function deleteClientAttachment(attachmentId: string): Promise<void> {
  if (isDatabaseEnabled()) {
    const sql = await getSql();
    await sql`delete from crm.client_attachments where id = ${attachmentId}`;
  } else {
    const existing = await readAttachmentsIndex();
    await writeAttachmentsIndex(existing.filter((record) => record.id !== attachmentId));
  }

  await rm(attachmentDir(attachmentId), { recursive: true, force: true });
}

export function attachmentStreamToWeb(stream: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}
