import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionConfig } from "@/lib/auth/session-config";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import {
  clientAttachmentDownloadPath,
  issueClientAttachmentDownloadToken,
} from "@/lib/clients/client-attachment-download";
import {
  appendClientAttachmentChunk,
  deleteClientAttachment,
  finalizeClientAttachmentUpload,
  getClientAttachmentUploadMeta,
  initClientAttachmentUpload,
  listClientAttachments,
} from "@/lib/clients/client-attachment.repository";
import {
  createClientAttendance,
  deleteClientAttendance,
  listClientAttendances,
} from "@/lib/clients/client-attendance.repository";
import { getClientSchedule, saveClientSchedule } from "@/lib/clients/client-schedule.repository";
import { addLocalDays } from "@/lib/dates/local-date";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";
import {
  bulkAddProductToClients,
  bulkDeleteClients,
  bulkScheduleClientsForUser,
  bulkUpdateClientStatus,
  countClientsInBulkScope,
  listClientsForBulkExport,
} from "@/lib/clients/client-bulk.repository";
import {
  buildClientsExportWorkbook,
  workbookToBase64,
} from "@/lib/clients/client-export-excel";
import {
  attendanceStatuses,
  isValidAttendanceStatus,
  resolveAttendanceStatusLabel,
} from "@/lib/clients/client-status";
import {
  createManualClient,
  getClientByIdForUser,
  importClients,
  listClientsPageForUser,
  updateClientStatus,
} from "@/lib/clients/clients.repository";
import { loadSystemSettingsFromDisk } from "@/lib/config/settings.repository";
import { findUserById } from "@/lib/users/user.repository";
import type {
  ClientBulkFilters,
  ClientBulkScope,
  ClientImportDisplay,
  ClientsPageQuery,
  CreateManualClientPayload,
  ImportClientsPayload,
  LeadDistribution,
} from "@/lib/clients/client.types";
import type { ClientFieldId } from "@/lib/config/client-fields";
import { isValidEmail } from "@/lib/masks/email";
import { createImportJob, getImportJob, requestCancelImportJob } from "@/lib/clients/import-job.repository";
import { runImportJobAsync } from "@/lib/clients/import-job.service";
import {
  appendImportUploadChunk,
  finalizeImportUpload,
  getImportUploadPath,
  getUploadMeta,
  initImportUpload,
} from "@/lib/clients/import-upload.repository";
import { parseExcelPreviewFromPath } from "@/lib/clients/parse-excel-server";
import { listAllUsers } from "@/lib/users/user.repository";

function requireClientesAccess() {
  return getSession(sessionConfig).then((session) => {
    const user = session.data;
    if (!user?.userId) throw new Error("Não autenticado.");
    if (!sessionCanAccessMenu(user, "clientes")) {
      throw new Error("Sem permissão para gerenciar clientes.");
    }
    return user;
  });
}

const importSchema = (data: unknown): ImportClientsPayload => {
  if (!data || typeof data !== "object") throw new Error("Dados de importação inválidos.");
  const payload = data as ImportClientsPayload;
  if (!payload.productId?.trim()) throw new Error("Selecione o produto.");
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    throw new Error("Nenhuma linha para importar.");
  }
  if (!payload.distribution || !payload.display) {
    throw new Error("Configure distribuição e exibição.");
  }
  return payload;
};

function normalizeIdListInput(...sources: unknown[]): string[] {
  const values: string[] = [];
  for (const source of sources) {
    if (Array.isArray(source)) {
      for (const item of source) {
        if (typeof item === "string" && item.trim()) values.push(item.trim());
      }
    } else if (typeof source === "string" && source.trim()) {
      values.push(source.trim());
    }
  }
  return [...new Set(values)];
}

const clientsPageSchema = (data: unknown): ClientsPageQuery => {
  if (!data || typeof data !== "object") return {};
  const payload = data as ClientsPageQuery;
  const attendance: ClientsPageQuery["attendance"] =
    payload.attendance === "with" || payload.attendance === "without" || payload.attendance === "all"
      ? payload.attendance
      : "all";
  const schedule: ClientsPageQuery["schedule"] = payload.schedule === "with" ? "with" : "all";
  const createdFrom =
    typeof payload.createdFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.createdFrom.trim())
      ? payload.createdFrom.trim()
      : "";
  const createdTo =
    typeof payload.createdTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.createdTo.trim())
      ? payload.createdTo.trim()
      : "";
  return {
    page: payload.page,
    pageSize: payload.pageSize,
    search: typeof payload.search === "string" ? payload.search : "",
    productIds: normalizeIdListInput(payload.productIds, payload.productId),
    statuses: normalizeIdListInput(payload.statuses, payload.status),
    attendance,
    schedule,
    createdFrom,
    createdTo,
  };
};

export const listClientsFn = createServerFn({ method: "POST" })
  .inputValidator(clientsPageSchema)
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    return listClientsPageForUser(user.userId, user.role === "master", data);
  });

function parseBulkScope(data: unknown): ClientBulkScope {
  if (!data || typeof data !== "object") throw new Error("Seleção inválida.");
  const payload = data as {
    mode?: string;
    clientIds?: string[];
    filters?: ClientBulkFilters;
  };
  if (payload.mode === "ids") {
    if (!Array.isArray(payload.clientIds) || payload.clientIds.length === 0) {
      throw new Error("Nenhum cliente selecionado.");
    }
    return { mode: "ids", clientIds: payload.clientIds };
  }
  if (payload.mode === "filter") {
    return { mode: "filter", filters: payload.filters ?? {} };
  }
  throw new Error("Modo de seleção inválido.");
}

export const countBulkClientsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => parseBulkScope(data))
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    const total = await countClientsInBulkScope(data, user.userId, user.role === "master");
    return { total };
  });

export const exportBulkClientsExcelFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => parseBulkScope(data))
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    const clients = await listClientsForBulkExport({
      scope: data,
      userId: user.userId,
      isMaster: user.role === "master",
    });
    const settings = await loadSystemSettingsFromDisk();
    const productNameById: Record<string, string> = {};
    for (const product of settings.products ?? []) {
      productNameById[product.id] = product.name || product.tag || product.id;
    }
    const statusLabelById: Record<string, string> = {};
    for (const status of settings.attendanceStatuses ?? []) {
      statusLabelById[status.id] = status.label || status.id;
    }
    const book = buildClientsExportWorkbook({
      clients,
      productNameById,
      statusLabelById,
    });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return {
      fileName: `clientes-export-${stamp}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: workbookToBase64(book),
      total: clients.length,
    };
  });

export const bulkScheduleClientsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
    const payload = data as {
      scope?: unknown;
      targetUserId?: string;
      contactDate?: string;
    };
    const scope = parseBulkScope(payload.scope);
    if (!payload.targetUserId?.trim()) throw new Error("Selecione o usuário da agenda.");
    if (!payload.contactDate?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(payload.contactDate.trim())) {
      throw new Error("Informe a data do contato.");
    }
    return {
      scope,
      targetUserId: payload.targetUserId.trim(),
      contactDate: payload.contactDate.trim(),
    };
  })
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    return bulkScheduleClientsForUser({
      scope: data.scope,
      actorUserId: user.userId,
      isMaster: user.role === "master",
      targetUserId: data.targetUserId,
      contactDate: data.contactDate,
    });
  });

export const bulkAddProductFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
    const payload = data as { scope?: unknown; productId?: string };
    const scope = parseBulkScope(payload.scope);
    if (!payload.productId?.trim()) throw new Error("Selecione um produto.");
    return { scope, productId: payload.productId.trim() };
  })
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    return bulkAddProductToClients({
      scope: data.scope,
      actorUserId: user.userId,
      isMaster: user.role === "master",
      productId: data.productId,
    });
  });

export const bulkDeleteClientsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => parseBulkScope(data))
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    return bulkDeleteClients({
      scope: data,
      actorUserId: user.userId,
      isMaster: user.role === "master",
    });
  });

export const bulkUpdateStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
    const payload = data as { scope?: unknown; status?: string };
    const scope = parseBulkScope(payload.scope);
    if (!payload.status?.trim()) throw new Error("Selecione o status.");
    return { scope, status: payload.status.trim() };
  })
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    const settings = await loadSystemSettingsFromDisk();
    if (!isValidAttendanceStatus(data.status, settings)) {
      throw new Error("Status de atendimento inválido.");
    }

    const result = await bulkUpdateClientStatus({
      scope: data.scope,
      actorUserId: user.userId,
      isMaster: user.role === "master",
      status: data.status,
    });

    const statusLabel = resolveAttendanceStatusLabel(data.status, settings);
    const author = await findUserById(user.userId);
    const userName = author?.name ?? author?.email ?? "Usuário";
    const statusConfig = attendanceStatuses(settings).find((item) => item.id === data.status);
    const autoReturnDays = statusConfig?.autoReturnDays ?? null;
    const scheduleContactDate =
      autoReturnDays && autoReturnDays > 0 ? addLocalDays(autoReturnDays) : null;

    let autoReturnNote = "";
    if (scheduleContactDate) {
      const [y, m, d] = scheduleContactDate.split("-");
      autoReturnNote = ` Retorno automático agendado para ${d}/${m}/${y} (${autoReturnDays} dia(s)).`;
    }

    for (const clientId of result.clientIds) {
      if (scheduleContactDate) {
        await saveClientSchedule({
          clientId,
          userId: user.userId,
          userName,
          contactDate: scheduleContactDate,
        });
        if (isDatabaseEnabled()) {
          const sql = await getSql();
          await sql`
            insert into crm.client_assignments (client_id, user_id)
            values (${clientId}, ${user.userId})
            on conflict do nothing
          `;
        }
      }

      await createClientAttendance({
        clientId,
        userId: user.userId,
        userName,
        note: `Status alterado em lote para: ${statusLabel}.${autoReturnNote}`,
      });
    }

    return { affected: result.affected };
  });

export const deleteClientAttendanceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Atendimento inválido.");
    const payload = data as { attendanceId?: string };
    if (!payload.attendanceId?.trim()) throw new Error("Atendimento inválido.");
    return { attendanceId: payload.attendanceId.trim() };
  })
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    await deleteClientAttendance({
      attendanceId: data.attendanceId,
      actorUserId: user.userId,
      isMaster: user.role === "master",
    });
    return { ok: true as const };
  });

export const listUsersForBulkActionsFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireClientesAccess();
  const users = await listAllUsers();
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    categoryId: user.categoryId,
    role: user.role,
  }));
});

export const getClientDetailFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Cliente inválido.");
    const payload = data as { clientId?: string };
    if (!payload.clientId?.trim()) throw new Error("Cliente inválido.");
    return { clientId: payload.clientId.trim() };
  })
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    const client = await getClientByIdForUser(data.clientId, user.userId, user.role === "master");
    if (!client) throw new Error("Cliente não encontrado.");
    return client;
  });

export const updateClientStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
    const payload = data as { clientId?: string; status?: string };
    if (!payload.clientId?.trim()) throw new Error("Cliente inválido.");
    if (!payload.status?.trim()) throw new Error("Status inválido.");
    return { clientId: payload.clientId.trim(), status: payload.status.trim() };
  })
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    const settings = await loadSystemSettingsFromDisk();
    if (!isValidAttendanceStatus(data.status, settings)) {
      throw new Error("Status de atendimento inválido.");
    }

    const previous = await getClientByIdForUser(
      data.clientId,
      user.userId,
      user.role === "master",
    );
    if (!previous) throw new Error("Cliente não encontrado.");

    const client = await updateClientStatus(
      data.clientId,
      user.userId,
      user.role === "master",
      data.status,
    );

    const statusLabel = resolveAttendanceStatusLabel(data.status, settings);
    const previousLabel = resolveAttendanceStatusLabel(previous.status, settings);
    const author = await findUserById(user.userId);
    const userName = author?.name ?? author?.email ?? "Usuário";

    const statusConfig = attendanceStatuses(settings).find((item) => item.id === data.status);
    const autoReturnDays = statusConfig?.autoReturnDays ?? null;
    let autoReturnNote = "";
    let scheduleContactDate: string | null = null;

    if (autoReturnDays && autoReturnDays > 0) {
      scheduleContactDate = addLocalDays(autoReturnDays);
      await saveClientSchedule({
        clientId: data.clientId,
        userId: user.userId,
        userName,
        contactDate: scheduleContactDate,
      });
      if (isDatabaseEnabled()) {
        const sql = await getSql();
        await sql`
          insert into crm.client_assignments (client_id, user_id)
          values (${data.clientId}, ${user.userId})
          on conflict do nothing
        `;
      }
      const [y, m, d] = scheduleContactDate.split("-");
      autoReturnNote = ` Retorno automático agendado para ${d}/${m}/${y} (${autoReturnDays} dia(s)).`;
    }

    const attendance = await createClientAttendance({
      clientId: data.clientId,
      userId: user.userId,
      userName,
      note:
        (previous.status === data.status
          ? `Status definido como: ${statusLabel}`
          : `Status alterado para: ${statusLabel} (antes: ${previousLabel})`) + autoReturnNote,
    });

    return { client, attendance, scheduleContactDate };
  });

export const listClientAttendancesFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Cliente inválido.");
    const payload = data as { clientId?: string };
    if (!payload.clientId?.trim()) throw new Error("Cliente inválido.");
    return { clientId: payload.clientId.trim() };
  })
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    const client = await getClientByIdForUser(data.clientId, user.userId, user.role === "master");
    if (!client) throw new Error("Cliente não encontrado.");
    return listClientAttendances(data.clientId);
  });

async function assertClientAccess(clientId: string) {
  const user = await requireClientesAccess();
  const client = await getClientByIdForUser(clientId, user.userId, user.role === "master");
  if (!client) throw new Error("Cliente não encontrado.");
  return { user, client };
}

const clientIdSchema = (data: unknown) => {
  if (!data || typeof data !== "object") throw new Error("Cliente inválido.");
  const payload = data as { clientId?: string };
  if (!payload.clientId?.trim()) throw new Error("Cliente inválido.");
  return { clientId: payload.clientId.trim() };
};

export const getClientScheduleFn = createServerFn({ method: "POST" })
  .inputValidator(clientIdSchema)
  .handler(async ({ data }) => {
    await assertClientAccess(data.clientId);
    return getClientSchedule(data.clientId);
  });

export const saveClientScheduleFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Agenda inválida.");
    const payload = data as { clientId?: string; contactDate?: string };
    if (!payload.clientId?.trim()) throw new Error("Cliente inválido.");
    if (!payload.contactDate?.trim()) throw new Error("Informe a data do contato.");
    return {
      clientId: payload.clientId.trim(),
      contactDate: payload.contactDate.trim(),
    };
  })
  .handler(async ({ data }) => {
    const { user } = await assertClientAccess(data.clientId);
    const author = await findUserById(user.userId);
    return saveClientSchedule({
      clientId: data.clientId,
      contactDate: data.contactDate,
      userId: user.userId,
      userName: author?.name ?? author?.email ?? "Usuário",
    });
  });

export const listClientAttachmentsFn = createServerFn({ method: "POST" })
  .inputValidator(clientIdSchema)
  .handler(async ({ data }) => {
    await assertClientAccess(data.clientId);
    return listClientAttachments(data.clientId);
  });

export const initClientAttachmentUploadFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Anexo inválido.");
    const payload = data as {
      clientId?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string | null;
      totalChunks?: number;
    };
    if (!payload.clientId?.trim()) throw new Error("Cliente inválido.");
    if (!payload.fileName?.trim()) throw new Error("Nome do arquivo inválido.");
    if (!payload.fileSize || payload.fileSize <= 0) throw new Error("Arquivo vazio.");
    if (!payload.totalChunks || payload.totalChunks <= 0) throw new Error("Envio inválido.");
    return {
      clientId: payload.clientId.trim(),
      fileName: payload.fileName.trim(),
      fileSize: payload.fileSize,
      mimeType: typeof payload.mimeType === "string" ? payload.mimeType : null,
      totalChunks: payload.totalChunks,
    };
  })
  .handler(async ({ data }) => {
    const { user } = await assertClientAccess(data.clientId);
    const author = await findUserById(user.userId);
    return initClientAttachmentUpload({
      clientId: data.clientId,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      totalChunks: data.totalChunks,
      userId: user.userId,
      userName: author?.name ?? author?.email ?? "Usuário",
    });
  });

export const appendClientAttachmentChunkFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Parte do anexo inválida.");
    const payload = data as { attachmentId?: string; chunkIndex?: number; chunkBase64?: string };
    if (!payload.attachmentId?.trim()) throw new Error("Anexo inválido.");
    if (payload.chunkIndex == null || payload.chunkIndex < 0) throw new Error("Parte inválida.");
    if (!payload.chunkBase64) throw new Error("Parte vazia.");
    return {
      attachmentId: payload.attachmentId.trim(),
      chunkIndex: payload.chunkIndex,
      chunkBase64: payload.chunkBase64,
    };
  })
  .handler(async ({ data }) => {
    const pending = await getClientAttachmentUploadMeta(data.attachmentId);
    if (!pending) throw new Error("Envio de anexo não encontrado.");
    await assertClientAccess(pending.clientId);
    return appendClientAttachmentChunk(data.attachmentId, data.chunkIndex, data.chunkBase64);
  });

export const finalizeClientAttachmentUploadFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Anexo inválido.");
    const payload = data as { attachmentId?: string; clientId?: string };
    if (!payload.attachmentId?.trim()) throw new Error("Anexo inválido.");
    if (!payload.clientId?.trim()) throw new Error("Cliente inválido.");
    return {
      attachmentId: payload.attachmentId.trim(),
      clientId: payload.clientId.trim(),
    };
  })
  .handler(async ({ data }) => {
    await assertClientAccess(data.clientId);
    return finalizeClientAttachmentUpload(data.attachmentId);
  });

export const deleteClientAttachmentFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Anexo inválido.");
    const payload = data as { attachmentId?: string; clientId?: string };
    if (!payload.attachmentId?.trim()) throw new Error("Anexo inválido.");
    if (!payload.clientId?.trim()) throw new Error("Cliente inválido.");
    return {
      attachmentId: payload.attachmentId.trim(),
      clientId: payload.clientId.trim(),
    };
  })
  .handler(async ({ data }) => {
    await assertClientAccess(data.clientId);
    await deleteClientAttachment(data.attachmentId);
    return { ok: true as const };
  });

export const issueClientAttachmentDownloadFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Anexo inválido.");
    const payload = data as { attachmentId?: string; clientId?: string };
    if (!payload.attachmentId?.trim()) throw new Error("Anexo inválido.");
    if (!payload.clientId?.trim()) throw new Error("Cliente inválido.");
    return {
      attachmentId: payload.attachmentId.trim(),
      clientId: payload.clientId.trim(),
    };
  })
  .handler(async ({ data }) => {
    await assertClientAccess(data.clientId);
    const token = issueClientAttachmentDownloadToken(data.attachmentId);
    return { url: clientAttachmentDownloadPath(token) };
  });

export const createClientAttendanceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Atendimento inválido.");
    const payload = data as { clientId?: string; note?: string };
    if (!payload.clientId?.trim()) throw new Error("Cliente inválido.");
    if (!payload.note?.trim()) throw new Error("Descreva o atendimento.");
    return { clientId: payload.clientId.trim(), note: payload.note.trim() };
  })
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    const client = await getClientByIdForUser(data.clientId, user.userId, user.role === "master");
    if (!client) throw new Error("Cliente não encontrado.");

    const author = await findUserById(user.userId);
    return createClientAttendance({
      clientId: data.clientId,
      userId: user.userId,
      userName: author?.name ?? author?.email ?? "Usuário",
      note: data.note,
    });
  });

export const listUsersForImportFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireClientesAccess();
  const users = await listAllUsers();
  return users
    .filter((user) => user.role !== "master")
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      categoryId: user.categoryId,
    }));
});

export const importClientsFn = createServerFn({ method: "POST" })
  .inputValidator(importSchema)
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    const scheduleContactDate =
      typeof data.scheduleContactDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.scheduleContactDate.trim())
        ? data.scheduleContactDate.trim()
        : undefined;
    return importClients({
      ...data,
      scheduleContactDate,
      scheduleUserId: scheduleContactDate ? user.userId : undefined,
      scheduleUserName: scheduleContactDate ? user.name : undefined,
    });
  });

const createManualSchema = (data: unknown): CreateManualClientPayload => {
  if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
  const payload = data as CreateManualClientPayload;
  if (!payload.productId?.trim()) throw new Error("Selecione o produto.");
  if (!payload.distribution) throw new Error("Configure a distribuição.");
  if (!payload.data || typeof payload.data !== "object") throw new Error("Preencha os dados do cliente.");
  const email = typeof payload.data.email === "string" ? payload.data.email : "";
  if (email.trim() && !isValidEmail(email)) {
    throw new Error("Informe um e-mail válido.");
  }
  return payload;
};

export const createManualClientFn = createServerFn({ method: "POST" })
  .inputValidator(createManualSchema)
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    const scheduleContactDate =
      typeof data.scheduleContactDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.scheduleContactDate.trim())
        ? data.scheduleContactDate.trim()
        : undefined;
    return createManualClient({
      ...data,
      scheduleContactDate,
      scheduleUserId: scheduleContactDate ? user.userId : undefined,
      scheduleUserName: scheduleContactDate ? user.name : undefined,
    });
  });

export const initImportUploadFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Dados de upload inválidos.");
    const payload = data as { fileName?: string; fileSize?: number; totalChunks?: number };
    if (!payload.fileName?.trim()) throw new Error("Nome do arquivo inválido.");
    if (!payload.fileSize || payload.fileSize <= 0) throw new Error("Tamanho do arquivo inválido.");
    if (!payload.totalChunks || payload.totalChunks <= 0) throw new Error("Upload inválido.");
    return {
      fileName: payload.fileName.trim(),
      fileSize: payload.fileSize,
      totalChunks: payload.totalChunks,
    };
  })
  .handler(async ({ data }) => {
    await requireClientesAccess();
    return initImportUpload(data);
  });

export const appendImportUploadChunkFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Chunk inválido.");
    const payload = data as { uploadId?: string; chunkIndex?: number; chunkBase64?: string };
    if (!payload.uploadId?.trim()) throw new Error("Upload inválido.");
    if (payload.chunkIndex == null || payload.chunkIndex < 0) throw new Error("Chunk inválido.");
    if (!payload.chunkBase64) throw new Error("Chunk vazio.");
    return {
      uploadId: payload.uploadId.trim(),
      chunkIndex: payload.chunkIndex,
      chunkBase64: payload.chunkBase64,
    };
  })
  .handler(async ({ data }) => {
    await requireClientesAccess();
    return appendImportUploadChunk(data.uploadId, data.chunkIndex, data.chunkBase64);
  });

export const finalizeImportUploadFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Upload inválido.");
    const payload = data as { uploadId?: string };
    if (!payload.uploadId?.trim()) throw new Error("Upload inválido.");
    return { uploadId: payload.uploadId.trim() };
  })
  .handler(async ({ data }) => {
    await requireClientesAccess();
    await finalizeImportUpload(data.uploadId);
    const meta = await getUploadMeta(data.uploadId);
    return { uploadId: data.uploadId, meta };
  });

export const parseImportUploadPreviewFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Prévia inválida.");
    const payload = data as { uploadId?: string; hasHeader?: boolean };
    if (!payload.uploadId?.trim()) throw new Error("Upload inválido.");
    return { uploadId: payload.uploadId.trim(), hasHeader: payload.hasHeader !== false };
  })
  .handler(async ({ data }) => {
    await requireClientesAccess();
    const filePath = await getImportUploadPath(data.uploadId);
    return parseExcelPreviewFromPath(filePath, data.hasHeader);
  });

type StartServerImportPayload = {
  uploadId: string;
  productId: string;
  hasHeader: boolean;
  columnMapping: Partial<Record<ClientFieldId, string>>;
  distribution: LeadDistribution;
  display: ClientImportDisplay;
  scheduleContactDate?: string;
};

export const startServerImportJobFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Importação inválida.");
    const payload = data as StartServerImportPayload;
    if (!payload.uploadId?.trim()) throw new Error("Upload inválido.");
    if (!payload.productId?.trim()) throw new Error("Selecione o produto.");
    if (!payload.distribution || !payload.display) {
      throw new Error("Configure distribuição e exibição.");
    }
    const scheduleContactDate =
      typeof payload.scheduleContactDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(payload.scheduleContactDate.trim())
        ? payload.scheduleContactDate.trim()
        : undefined;
    return { ...payload, scheduleContactDate };
  })
  .handler(async ({ data }) => {
    const user = await requireClientesAccess();
    const job = await createImportJob({
      uploadId: data.uploadId,
      productId: data.productId,
      hasHeader: data.hasHeader,
      columnMapping: data.columnMapping,
      distribution: data.distribution,
      display: {
        ...data.display,
        ...(data.scheduleContactDate
          ? {
              scheduleContactDate: data.scheduleContactDate,
              scheduleUserId: user.userId,
              scheduleUserName: user.name,
            }
          : {}),
      },
    });
    runImportJobAsync(job.id);
    return { jobId: job.id };
  });

export const getImportJobStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Job inválido.");
    const payload = data as { jobId?: string };
    if (!payload.jobId?.trim()) throw new Error("Job inválido.");
    return { jobId: payload.jobId.trim() };
  })
  .handler(async ({ data }) => {
    await requireClientesAccess();
    const job = await getImportJob(data.jobId);
    if (!job) throw new Error("Job de importação não encontrado.");
    return job;
  });

export const cancelImportJobFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Job inválido.");
    const payload = data as { jobId?: string };
    if (!payload.jobId?.trim()) throw new Error("Job inválido.");
    return { jobId: payload.jobId.trim() };
  })
  .handler(async ({ data }) => {
    await requireClientesAccess();
    return requestCancelImportJob(data.jobId);
  });
