import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ClientFieldId } from "@/lib/config/client-fields";
import type { ImportJobDisplay, LeadDistribution } from "@/lib/clients/client.types";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";

const JOBS_DIR = join(process.cwd(), "data", "import-jobs");

export type ImportJobStatus = "queued" | "parsing" | "importing" | "done" | "error" | "cancelled";

export type ImportJobRecord = {
  id: string;
  uploadId: string;
  productId: string;
  hasHeader: boolean;
  columnMapping: Partial<Record<ClientFieldId, string>>;
  distribution: LeadDistribution;
  display: ImportJobDisplay;
  status: ImportJobStatus;
  phaseLabel: string;
  processed: number;
  total: number;
  imported: number;
  batchId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type ImportJobRow = {
  id: string;
  upload_id: string | null;
  product_id: string;
  has_header: boolean;
  column_mapping: Partial<Record<ClientFieldId, string>>;
  distribution: LeadDistribution;
  display: ImportJobDisplay;
  status: ImportJobStatus;
  phase_label: string | null;
  processed: number;
  total: number;
  imported: number;
  batch_id: string | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
};

function jobPath(jobId: string) {
  return join(JOBS_DIR, `${jobId}.json`);
}

function mapImportJobRow(row: ImportJobRow): ImportJobRecord {
  return {
    id: row.id,
    uploadId: row.upload_id ?? "",
    productId: row.product_id,
    hasHeader: row.has_header,
    columnMapping: row.column_mapping ?? {},
    distribution: row.distribution,
    display: row.display,
    status: row.status,
    phaseLabel: row.phase_label ?? "",
    processed: row.processed,
    total: row.total,
    imported: row.imported,
    batchId: row.batch_id ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function getImportJobFromPostgres(jobId: string): Promise<ImportJobRecord | null> {
  const sql = await getSql();
  const rows = await sql<ImportJobRow[]>`
    select
      id, upload_id, product_id, has_header, column_mapping, distribution, display,
      status, phase_label, processed, total, imported, batch_id, error, created_at, updated_at
    from crm.import_jobs
    where id = ${jobId}
    limit 1
  `;
  return rows[0] ? mapImportJobRow(rows[0]) : null;
}

async function createImportJobInPostgres(
  input: Omit<
    ImportJobRecord,
    "id" | "status" | "phaseLabel" | "processed" | "total" | "imported" | "createdAt" | "updatedAt"
  >,
): Promise<ImportJobRecord> {
  const sql = await getSql();
  const now = new Date().toISOString();
  const job: ImportJobRecord = {
    id: `job-${crypto.randomUUID().slice(0, 12)}`,
    ...input,
    status: "queued",
    phaseLabel: "Na fila",
    processed: 0,
    total: 0,
    imported: 0,
    createdAt: now,
    updatedAt: now,
  };

  await sql`
    insert into crm.import_jobs (
      id, upload_id, product_id, has_header, column_mapping, distribution, display,
      status, phase_label, processed, total, imported, batch_id, error, created_at, updated_at
    ) values (
      ${job.id},
      ${job.uploadId},
      ${job.productId},
      ${job.hasHeader},
      ${sql.json(job.columnMapping)},
      ${sql.json(job.distribution)},
      ${sql.json(job.display)},
      ${job.status},
      ${job.phaseLabel},
      ${job.processed},
      ${job.total},
      ${job.imported},
      ${job.batchId ?? null},
      ${job.error ?? null},
      ${job.createdAt},
      ${job.updatedAt}
    )
  `;

  return job;
}

async function updateImportJobInPostgres(
  jobId: string,
  patch: Partial<ImportJobRecord>,
): Promise<ImportJobRecord> {
  const current = await getImportJobFromPostgres(jobId);
  if (!current) throw new Error("Job de importação não encontrado.");

  const next: ImportJobRecord = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  const sql = await getSql();
  await sql`
    update crm.import_jobs set
      upload_id = ${next.uploadId},
      product_id = ${next.productId},
      has_header = ${next.hasHeader},
      column_mapping = ${sql.json(next.columnMapping)},
      distribution = ${sql.json(next.distribution)},
      display = ${sql.json(next.display)},
      status = ${next.status},
      phase_label = ${next.phaseLabel},
      processed = ${next.processed},
      total = ${next.total},
      imported = ${next.imported},
      batch_id = ${next.batchId ?? null},
      error = ${next.error ?? null},
      updated_at = ${next.updatedAt}
    where id = ${jobId}
  `;

  return next;
}

export async function createImportJob(
  input: Omit<
    ImportJobRecord,
    "id" | "status" | "phaseLabel" | "processed" | "total" | "imported" | "createdAt" | "updatedAt"
  >,
): Promise<ImportJobRecord> {
  if (isDatabaseEnabled()) {
    return createImportJobInPostgres(input);
  }

  await mkdir(JOBS_DIR, { recursive: true });
  const now = new Date().toISOString();
  const job: ImportJobRecord = {
    id: `job-${crypto.randomUUID().slice(0, 12)}`,
    ...input,
    status: "queued",
    phaseLabel: "Na fila",
    processed: 0,
    total: 0,
    imported: 0,
    createdAt: now,
    updatedAt: now,
  };
  await writeFile(jobPath(job.id), JSON.stringify(job, null, 2), "utf8");
  return job;
}

export async function getImportJob(jobId: string): Promise<ImportJobRecord | null> {
  if (isDatabaseEnabled()) {
    return getImportJobFromPostgres(jobId);
  }

  try {
    const raw = await readFile(jobPath(jobId), "utf8");
    return JSON.parse(raw) as ImportJobRecord;
  } catch {
    return null;
  }
}

export async function updateImportJob(
  jobId: string,
  patch: Partial<ImportJobRecord>,
): Promise<ImportJobRecord> {
  if (isDatabaseEnabled()) {
    return updateImportJobInPostgres(jobId, patch);
  }

  const current = await getImportJob(jobId);
  if (!current) throw new Error("Job de importação não encontrado.");

  const next: ImportJobRecord = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(jobPath(jobId), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function requestCancelImportJob(jobId: string): Promise<ImportJobRecord> {
  const current = await getImportJob(jobId);
  if (!current) throw new Error("Job de importação não encontrado.");

  if (current.status === "done" || current.status === "error" || current.status === "cancelled") {
    return current;
  }

  return updateImportJob(jobId, {
    status: "cancelled",
    phaseLabel:
      current.imported > 0
        ? `Cancelando… ${current.imported.toLocaleString("pt-BR")} cliente(s) já importados`
        : "Cancelando importação…",
  });
}
