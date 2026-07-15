import { existsSync } from "node:fs";
import { mkdir, open, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";

const UPLOADS_DIR = join(process.cwd(), "data", "uploads");

export type UploadMeta = {
  uploadId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  receivedChunks: number;
  createdAt: string;
};

type UploadRow = {
  id: string;
  file_name: string;
  file_size: string;
  total_chunks: number;
  received_chunks: number;
  created_at: Date;
};

function uploadDir(uploadId: string) {
  return join(UPLOADS_DIR, uploadId);
}

function metaPath(uploadId: string) {
  return join(uploadDir(uploadId), "meta.json");
}

function filePath(uploadId: string) {
  return join(uploadDir(uploadId), "file.bin");
}

function chunkPath(uploadId: string, index: number) {
  return join(uploadDir(uploadId), `chunk-${index}.bin`);
}

function mapUploadRow(row: UploadRow): UploadMeta {
  return {
    uploadId: row.id,
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    totalChunks: row.total_chunks,
    receivedChunks: row.received_chunks,
    createdAt: row.created_at.toISOString(),
  };
}

async function syncUploadMetaToPostgres(meta: UploadMeta, status: string, storagePath?: string | null) {
  if (!isDatabaseEnabled()) return;
  const sql = await getSql();
  await sql`
    insert into crm.import_uploads (
      id, file_name, file_size, total_chunks, received_chunks, storage_path, status, created_at, updated_at
    ) values (
      ${meta.uploadId},
      ${meta.fileName},
      ${meta.fileSize},
      ${meta.totalChunks},
      ${meta.receivedChunks},
      ${storagePath ?? null},
      ${status},
      ${meta.createdAt},
      now()
    )
    on conflict (id) do update set
      received_chunks = excluded.received_chunks,
      storage_path = coalesce(excluded.storage_path, crm.import_uploads.storage_path),
      status = excluded.status,
      updated_at = now()
  `;
}

async function getUploadMetaFromPostgres(uploadId: string): Promise<UploadMeta | null> {
  const sql = await getSql();
  const rows = await sql<UploadRow[]>`
    select id, file_name, file_size, total_chunks, received_chunks, created_at
    from crm.import_uploads
    where id = ${uploadId}
    limit 1
  `;
  return rows[0] ? mapUploadRow(rows[0]) : null;
}

export async function initImportUpload(input: {
  fileName: string;
  fileSize: number;
  totalChunks: number;
}): Promise<UploadMeta> {
  const uploadId = `upload-${crypto.randomUUID().slice(0, 12)}`;
  const dir = uploadDir(uploadId);
  await mkdir(dir, { recursive: true });

  const meta: UploadMeta = {
    uploadId,
    fileName: input.fileName,
    fileSize: input.fileSize,
    totalChunks: input.totalChunks,
    receivedChunks: 0,
    createdAt: new Date().toISOString(),
  };

  await writeFile(metaPath(uploadId), JSON.stringify(meta, null, 2), "utf8");
  await syncUploadMetaToPostgres(meta, "uploading");
  return meta;
}

export async function getUploadMeta(uploadId: string): Promise<UploadMeta | null> {
  if (isDatabaseEnabled()) {
    const fromDb = await getUploadMetaFromPostgres(uploadId);
    if (fromDb) return fromDb;
  }

  try {
    const raw = await readFile(metaPath(uploadId), "utf8");
    return JSON.parse(raw) as UploadMeta;
  } catch {
    return null;
  }
}

export async function appendImportUploadChunk(
  uploadId: string,
  chunkIndex: number,
  chunkBase64: string,
): Promise<UploadMeta> {
  const meta = await getUploadMeta(uploadId);
  if (!meta) throw new Error("Upload não encontrado.");

  if (chunkIndex < 0 || chunkIndex >= meta.totalChunks) {
    throw new Error("Índice de chunk inválido.");
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(chunkBase64, "base64");
  } catch {
    throw new Error("Falha ao decodificar parte do arquivo. Tente enviar a planilha novamente.");
  }
  if (buffer.length === 0) {
    throw new Error(`Parte ${chunkIndex + 1} chegou vazia. Tente enviar a planilha novamente.`);
  }
  await writeFile(chunkPath(uploadId, chunkIndex), buffer);

  const received = new Set<number>();
  const files = await readdir(uploadDir(uploadId));
  for (const name of files) {
    const match = name.match(/^chunk-(\d+)\.bin$/);
    if (match) received.add(Number(match[1]));
  }

  meta.receivedChunks = received.size;
  await writeFile(metaPath(uploadId), JSON.stringify(meta, null, 2), "utf8");
  await syncUploadMetaToPostgres(meta, "uploading");
  return meta;
}

function assertZipArchiveHeader(header: Buffer) {
  const isZip = header[0] === 0x50 && header[1] === 0x4b;
  if (!isZip) {
    throw new Error(
      "Arquivo corrompido após o envio. Selecione a planilha novamente e aguarde o progresso até o fim.",
    );
  }
}

export async function finalizeImportUpload(uploadId: string): Promise<string> {
  const meta = await getUploadMeta(uploadId);
  if (!meta) throw new Error("Upload não encontrado.");
  if (meta.receivedChunks !== meta.totalChunks) {
    throw new Error(`Upload incompleto (${meta.receivedChunks}/${meta.totalChunks} partes).`);
  }

  const target = filePath(uploadId);
  const output = await open(target, "w");
  try {
    for (let index = 0; index < meta.totalChunks; index += 1) {
      const part = await readFile(chunkPath(uploadId, index));
      if (part.length === 0) {
        throw new Error(`Parte ${index + 1} do envio chegou vazia. Selecione a planilha novamente.`);
      }
      await output.write(part);
      await rm(chunkPath(uploadId, index), { force: true });
    }
  } finally {
    await output.close();
  }

  const size = (await stat(target)).size;
  if (size !== meta.fileSize) {
    throw new Error(
      `Arquivo incompleto após envio (esperado ${meta.fileSize} bytes, recebido ${size}). Tente novamente.`,
    );
  }

  const header = Buffer.alloc(4);
  const input = await open(target, "r");
  try {
    await input.read(header, 0, 4, 0);
  } finally {
    await input.close();
  }
  assertZipArchiveHeader(header);

  await syncUploadMetaToPostgres(meta, "ready", target);
  return target;
}

export async function getImportUploadPath(uploadId: string): Promise<string> {
  const path = filePath(uploadId);
  if (!existsSync(path)) {
    await finalizeImportUpload(uploadId).catch(() => undefined);
  }
  if (!existsSync(path)) {
    throw new Error("Arquivo do upload não encontrado. Envie a planilha novamente.");
  }
  return path;
}

export async function removeImportUpload(uploadId: string): Promise<void> {
  const meta = await getUploadMeta(uploadId);
  if (meta) {
    await syncUploadMetaToPostgres(meta, "removed");
  }
  await rm(uploadDir(uploadId), { recursive: true, force: true });
}
