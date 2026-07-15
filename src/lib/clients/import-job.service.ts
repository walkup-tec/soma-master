import { loadSystemSettingsFromDisk } from "@/lib/config/settings.repository";

import { CLIENT_DATABASE_LIMIT, hasClientDatabaseLimit } from "@/lib/clients/client-limit";
import {
  appendClientRecords,
  countAllClients,
  mapRowToClientData,
  resolveAssignedUserIds,
  resolveScheduleActor,
} from "@/lib/clients/clients.repository";

import type { ClientRecord } from "@/lib/clients/client.types";
import { toClientImportDisplay } from "@/lib/clients/client.types";
import { saveClientSchedulesBulk } from "@/lib/clients/client-schedule.repository";

import { ImportCancelledError } from "@/lib/clients/import-cancelled.error";
import { ImportLimitReachedError } from "@/lib/clients/import-limit.error";

import { getImportUploadPath, removeImportUpload } from "@/lib/clients/import-upload.repository";

import { getImportJob, updateImportJob } from "@/lib/clients/import-job.repository";

import { iterateExcelRowsFromPath } from "@/lib/clients/parse-excel-server";

import { readXlsxDimensionRowCount } from "@/lib/clients/xlsx-zip-stream";



const runningJobs = new Set<string>();

const IMPORT_BATCH_SIZE = 5000;

const JOB_UPDATE_INTERVAL_MS = 2500;



async function assertJobNotCancelled(jobId: string): Promise<void> {

  const job = await getImportJob(jobId);

  if (job?.status === "cancelled") {

    throw new ImportCancelledError(job.imported);

  }

}



export function runImportJobAsync(jobId: string): void {

  if (runningJobs.has(jobId)) return;

  runningJobs.add(jobId);

  void executeImportJob(jobId).finally(() => {

    runningJobs.delete(jobId);

  });

}



async function executeImportJob(jobId: string): Promise<void> {

  const job = await getImportJob(jobId);

  if (!job) return;



  try {

    await assertJobNotCancelled(jobId);

    await updateImportJob(jobId, { status: "parsing", phaseLabel: "Preparando planilha no servidor…" });



    const settings = await loadSystemSettingsFromDisk();

    const product = settings.products.find((item) => item.id === job.productId);

    if (!product) throw new Error("Produto inválido.");



    for (const fieldId of product.requiredFieldIds) {

      if (!job.columnMapping[fieldId]) {

        throw new Error(`Campo obrigatório não indexado: ${fieldId}`);

      }

    }



    const assignedUserIds = await resolveAssignedUserIds(job.distribution);

    if (assignedUserIds.length === 0) {

      throw new Error("Nenhum usuário elegível para receber os leads.");

    }



    await assertJobNotCancelled(jobId);



    const filePath = await getImportUploadPath(job.uploadId);

    const sheetRows = await readXlsxDimensionRowCount(filePath);

    const sheetDataRows = job.hasHeader ? Math.max(0, sheetRows - 1) : sheetRows;
    let importCap: number | undefined;
    if (hasClientDatabaseLimit() && CLIENT_DATABASE_LIMIT != null) {
      const existingClients = await countAllClients();
      if (existingClients >= CLIENT_DATABASE_LIMIT) {
        throw new Error(
          `Limite de ${CLIENT_DATABASE_LIMIT.toLocaleString("pt-BR")} clientes já atingido.`,
        );
      }
      importCap = CLIENT_DATABASE_LIMIT - existingClients;
    }
    const totalRows =
      importCap !== undefined ? Math.min(sheetDataRows, importCap) : sheetDataRows;

    const batchId = `batch-${crypto.randomUUID().slice(0, 8)}`;

    const createdAt = new Date().toISOString();



    await updateImportJob(jobId, {

      status: "importing",

      phaseLabel: `0 de ${totalRows.toLocaleString("pt-BR")} clientes`,

      batchId,

      total: totalRows,

      processed: 0,

      imported: 0,

    });



    let lastJobUpdateAt = 0;



    const result = await iterateExcelRowsFromPath(

      filePath,

      job.hasHeader,

      async (rows, progress) => {

        const clientDisplay = toClientImportDisplay(job.display);
        const records: ClientRecord[] = rows.map((row) => ({

          id: `client-${crypto.randomUUID().slice(0, 8)}`,

          productId: job.productId,

          importBatchId: batchId,

          data: mapRowToClientData(row, job.columnMapping),

          assignedUserIds,

          distribution: job.distribution,

          display: clientDisplay,

          status: "novo",

          createdAt,

        }));



        await appendClientRecords(records);

        const scheduleContactDate = job.display.scheduleContactDate?.trim();
        if (scheduleContactDate && /^\d{4}-\d{2}-\d{2}$/.test(scheduleContactDate)) {
          const actor = await resolveScheduleActor(assignedUserIds, {
            userId: job.display.scheduleUserId?.trim() || "",
            userName: job.display.scheduleUserName?.trim() || "Usuário",
          });
          if (actor) {
            await saveClientSchedulesBulk({
              clientIds: records.map((record) => record.id),
              userId: actor.userId,
              userName: actor.userName,
              contactDate: scheduleContactDate,
            });
          }
        }



        const now = Date.now();

        const isDone = progress.processed >= progress.total;

        if (isDone || now - lastJobUpdateAt >= JOB_UPDATE_INTERVAL_MS) {

          lastJobUpdateAt = now;

          await updateImportJob(jobId, {

            status: "importing",

            phaseLabel: `${progress.processed.toLocaleString("pt-BR")} de ${progress.total.toLocaleString("pt-BR")} clientes`,

            processed: progress.processed,

            total: progress.total,

            imported: progress.processed,

          });

        }

      },

      {
        batchSize: IMPORT_BATCH_SIZE,
        ...(importCap !== undefined ? { maxRows: importCap } : {}),
        onPhase: (label) => updateImportJob(jobId, { phaseLabel: label, total: totalRows }),
        shouldAbort: async () => {
          const current = await getImportJob(jobId);
          return current?.status === "cancelled";
        },
      },

    );



    await assertJobNotCancelled(jobId);



    await updateImportJob(jobId, {

      status: "done",

      phaseLabel: `${result.totalRows.toLocaleString("pt-BR")} cliente(s) importado(s)`,

      processed: result.totalRows,

      total: result.totalRows,

      imported: result.totalRows,

    });



    await removeImportUpload(job.uploadId).catch(() => undefined);

  } catch (error) {

    if (error instanceof ImportCancelledError) {
      await updateImportJob(jobId, {
        status: "cancelled",
        phaseLabel: `${error.imported.toLocaleString("pt-BR")} cliente(s) importados — importação cancelada`,
        imported: error.imported,
        processed: error.imported,
      });
      await removeImportUpload(job.uploadId).catch(() => undefined);
      return;
    }

    if (error instanceof ImportLimitReachedError) {
      const limitLabel =
        hasClientDatabaseLimit() && CLIENT_DATABASE_LIMIT != null
          ? CLIENT_DATABASE_LIMIT.toLocaleString("pt-BR")
          : "configurado";
      await updateImportJob(jobId, {
        status: "done",
        phaseLabel: `${error.imported.toLocaleString("pt-BR")} cliente(s) importado(s) — limite de ${limitLabel} atingido`,
        imported: error.imported,
        processed: error.imported,
        total: error.imported,
      });
      await removeImportUpload(job.uploadId).catch(() => undefined);
      return;
    }

    await updateImportJob(jobId, {

      status: "error",

      phaseLabel: "Falha na importação",

      error: error instanceof Error ? error.message : "Erro desconhecido na importação.",

    });

  }

}

