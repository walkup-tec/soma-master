import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ClientFieldId } from "@/lib/config/client-fields";
import { loadSystemSettingsFromDisk } from "@/lib/config/settings.repository";
import { listAllUsers } from "@/lib/users/user.repository";
import { clientFieldLabel } from "@/lib/config/client-fields";
import { getClientActivityFlagsForClients } from "@/lib/clients/client-activity.repository";
import { isConcludedAttendanceStatus } from "@/lib/clients/client-status";
import type {
  AgendaAlertCounts,
  AgendaFilter,
  AgendaListQuery,
  ClientActivityFlags,
  ClientAttendanceFilter,
  ClientScheduleFilter,
  ClientListItem,
  ClientRecord,
  ClientsPageQuery,
  ClientsPageResult,
  CreateManualClientPayload,
  ImportClientsPayload,
  LeadDistribution,
  KanbanListItem,
  RemarketingFilter,
  RemarketingListItem,
  RemarketingListQuery,
} from "@/lib/clients/client.types";
import type { DashboardSummary } from "@/lib/clients/dashboard.types";
import { getClientSchedule, saveClientSchedulesBulk } from "@/lib/clients/client-schedule.repository";
import {
  createdAtToLocalDate,
  localDateString,
  localTomorrowString,
  resolveRemarketingDateRange,
} from "@/lib/dates/local-date";
import { CLIENT_DATABASE_LIMIT, hasClientDatabaseLimit } from "@/lib/clients/client-limit";
import { getSql, isDatabaseEnabled, type Sql } from "@/lib/db/postgres";

const DATA_DIR = join(process.cwd(), "data");
const CLIENTS_FILE = join(DATA_DIR, "clients.json");
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const EMPTY_ACTIVITY_FLAGS: ClientActivityFlags = {
  hasSchedule: false,
  hasAttendance: false,
  hasAttachments: false,
};

const CLIENT_LIST_ACTIVITY_COLUMNS = `
  exists (select 1 from crm.client_schedules sch where sch.client_id = c.id) as has_schedule,
  exists (select 1 from crm.client_attendances att where att.client_id = c.id) as has_attendance,
  exists (select 1 from crm.client_attachments fil where fil.client_id = c.id) as has_attachments
`;

let cachedClients: ClientRecord[] | null = null;

type ClientRow = {
  id: string;
  product_id: string;
  import_batch_id: string | null;
  status: string;
  data: Record<string, string>;
  distribution: LeadDistribution;
  display: ClientRecord["display"];
  created_at: Date;
  assigned_user_ids: string[] | null;
};

async function readClientsFromDisk(): Promise<ClientRecord[]> {
  if (cachedClients) return cachedClients;
  try {
    const raw = await readFile(CLIENTS_FILE, "utf8");
    const parsed = JSON.parse(raw) as ClientRecord[];
    cachedClients = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedClients = [];
  }
  return cachedClients;
}

async function writeClientsToDisk(clients: ClientRecord[]): Promise<void> {
  cachedClients = clients;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CLIENTS_FILE, JSON.stringify(clients, null, 2), "utf8");
}

export async function countAllClients(): Promise<number> {
  if (isDatabaseEnabled()) {
    const sql = await getSql();
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from crm.clients
    `;
    return count ?? 0;
  }
  const clients = await readClientsFromDisk();
  return clients.length;
}

export async function assertClientDatabaseHasRoom(extra = 1): Promise<void> {
  if (!hasClientDatabaseLimit() || CLIENT_DATABASE_LIMIT == null) return;
  const total = await countAllClients();
  if (total + extra > CLIENT_DATABASE_LIMIT) {
    throw new Error(
      `Limite de ${CLIENT_DATABASE_LIMIT.toLocaleString("pt-BR")} clientes atingido (${total.toLocaleString("pt-BR")} na base).`,
    );
  }
}

type NormalizedClientsPageQuery = Required<
  Pick<ClientsPageQuery, "page" | "pageSize" | "search">
> & {
  productIds: string[];
  statuses: string[];
  attendance: ClientAttendanceFilter;
  schedule: ClientScheduleFilter;
  createdFrom: string;
  createdTo: string;
};

function normalizeIsoDate(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : "";
}

function normalizeIdList(...sources: unknown[]): string[] {
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

function normalizeClientsPageQuery(query: ClientsPageQuery = {}): NormalizedClientsPageQuery {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(10, Number(query.pageSize) || DEFAULT_PAGE_SIZE));
  const search = typeof query.search === "string" ? query.search.trim().slice(0, 100) : "";
  const productIds = normalizeIdList(query.productIds, query.productId);
  const statuses = normalizeIdList(query.statuses, query.status);
  const attendance =
    query.attendance === "with" || query.attendance === "without" ? query.attendance : "all";
  const schedule = query.schedule === "with" ? "with" : "all";
  let createdFrom = normalizeIsoDate(query.createdFrom);
  let createdTo = normalizeIsoDate(query.createdTo);
  if (createdFrom && createdTo && createdFrom > createdTo) {
    const swap = createdFrom;
    createdFrom = createdTo;
    createdTo = swap;
  }
  return {
    page,
    pageSize,
    search,
    productIds,
    statuses,
    attendance,
    schedule,
    createdFrom,
    createdTo,
  };
}

function distributionLabel(distribution: LeadDistribution): string {
  if (distribution.type === "all") return "Todos";
  if (distribution.type === "category") return `${distribution.categoryIds.length} categoria(s)`;
  return `${distribution.userIds.length} usuário(s)`;
}

function mapClientListItem(record: ClientRecord): ClientListItem {
  return {
    ...EMPTY_ACTIVITY_FLAGS,
    id: record.id,
    productId: record.productId,
    productIds: record.productIds?.length ? record.productIds : [record.productId],
    status: record.status,
    nome: record.data.nome ?? null,
    cpf: record.data.cpf ?? null,
    telefone: record.data.telefone ?? null,
    distributionType: record.distribution.type,
    distributionLabel: distributionLabel(record.distribution),
    displayMode: record.display.mode,
    displayFieldCount: record.display.visibleFieldIds.length,
    createdAt: record.createdAt,
  };
}

function mapClientRow(row: ClientRow): ClientRecord {
  return {
    id: row.id,
    productId: row.product_id,
    importBatchId: row.import_batch_id ?? "",
    data: row.data as Partial<Record<ClientFieldId, string>>,
    assignedUserIds: row.assigned_user_ids ?? [],
    distribution: row.distribution,
    display: row.display,
    status: row.status || "novo",
    createdAt: row.created_at.toISOString(),
  };
}

type ClientListRow = {
  id: string;
  product_id: string;
  product_ids: string[] | null;
  status: string;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  distribution: LeadDistribution;
  display: ClientRecord["display"];
  created_at: Date;
  has_schedule: boolean;
  has_attendance: boolean;
  has_attachments: boolean;
};

function mapClientListRow(row: ClientListRow): ClientListItem {
  const productIds = [...new Set([row.product_id, ...(row.product_ids ?? [])].filter(Boolean))];
  return {
    id: row.id,
    productId: row.product_id,
    productIds: productIds.length > 0 ? productIds : [row.product_id],
    status: row.status,
    nome: row.nome,
    cpf: row.cpf,
    telefone: row.telefone,
    distributionType: row.distribution.type,
    distributionLabel: distributionLabel(row.distribution),
    displayMode: row.display.mode,
    displayFieldCount: row.display.visibleFieldIds.length,
    createdAt: row.created_at.toISOString(),
    hasSchedule: row.has_schedule,
    hasAttendance: row.has_attendance,
    hasAttachments: row.has_attachments,
  };
}

async function enrichClientListItems(items: ClientListItem[]): Promise<ClientListItem[]> {
  if (items.length === 0) return items;
  const flags = await getClientActivityFlagsForClients(items.map((item) => item.id));
  return items.map((item) => ({
    ...item,
    ...(flags[item.id] ?? EMPTY_ACTIVITY_FLAGS),
  }));
}

function matchesClientSearch(record: ClientRecord, search: string): boolean {
  if (!search) return true;
  const term = search.toLowerCase();
  const values = [record.data.nome, record.data.cpf, record.data.telefone, record.id];
  return values.some((value) => value?.toLowerCase().includes(term));
}

function buildClientsListWhereClause(
  sql: Sql,
  query: NormalizedClientsPageQuery,
  searchPattern: string | null,
) {
  const hasSearch = Boolean(searchPattern);
  const hasProduct = query.productIds.length > 0;
  const hasStatus = query.statuses.length > 0;
  const hasAttendance = query.attendance === "with" || query.attendance === "without";
  const hasSchedule = query.schedule === "with";
  const hasCreatedFrom = Boolean(query.createdFrom);
  const hasCreatedTo = Boolean(query.createdTo);

  if (
    !hasSearch &&
    !hasProduct &&
    !hasStatus &&
    !hasAttendance &&
    !hasSchedule &&
    !hasCreatedFrom &&
    !hasCreatedTo
  )
    return sql``;

  return sql`
    where true
    ${
      hasSearch
        ? sql`and (
            coalesce(c.data->>'nome', '') ilike ${searchPattern}
            or coalesce(c.data->>'cpf', '') ilike ${searchPattern}
            or coalesce(c.data->>'telefone', '') ilike ${searchPattern}
          )`
        : sql``
    }
    ${
      hasProduct
        ? sql`and (
            c.product_id = any(${query.productIds})
            or exists (
              select 1 from crm.client_products cp
              where cp.client_id = c.id and cp.product_id = any(${query.productIds})
            )
          )`
        : sql``
    }
    ${hasStatus ? sql`and c.status = any(${query.statuses})` : sql``}
    ${
      query.attendance === "with"
        ? sql`and exists (select 1 from crm.client_attendances att where att.client_id = c.id)`
        : sql``
    }
    ${
      query.attendance === "without"
        ? sql`and not exists (select 1 from crm.client_attendances att where att.client_id = c.id)`
        : sql``
    }
    ${
      hasSchedule
        ? sql`and exists (select 1 from crm.client_schedules sch where sch.client_id = c.id)`
        : sql``
    }
    ${
      hasCreatedFrom
        ? sql`and ((c.created_at at time zone 'America/Sao_Paulo')::date >= ${query.createdFrom}::date)`
        : sql``
    }
    ${
      hasCreatedTo
        ? sql`and ((c.created_at at time zone 'America/Sao_Paulo')::date <= ${query.createdTo}::date)`
        : sql``
    }
  `;
}

async function listClientsPageFromPostgres(
  userId: string,
  isMaster: boolean,
  query: NormalizedClientsPageQuery,
): Promise<ClientsPageResult> {
  const sql = await getSql();
  const searchPattern = query.search ? `%${query.search}%` : null;

  const assignmentJoin = isMaster
    ? sql``
    : sql`inner join crm.client_assignments mine on mine.client_id = c.id and mine.user_id = ${userId}`;

  const whereClause = buildClientsListWhereClause(sql, query, searchPattern);

  const countRows = await sql<{ total: number }[]>`
    select count(*)::int as total
    from crm.clients c
    ${assignmentJoin}
    ${whereClause}
  `;

  const total = countRows[0]?.total ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(query.page, totalPages);
  const safeOffset = (safePage - 1) * query.pageSize;

  const rows = await sql<ClientListRow[]>`
    select
      c.id,
      c.product_id,
      (
        select coalesce(array_agg(distinct pid), array[c.product_id])
        from (
          select c.product_id as pid
          union
          select cp.product_id from crm.client_products cp where cp.client_id = c.id
        ) products
      ) as product_ids,
      c.status,
      c.data->>'nome' as nome,
      c.data->>'cpf' as cpf,
      c.data->>'telefone' as telefone,
      c.distribution,
      c.display,
      c.created_at,
      ${sql.unsafe(CLIENT_LIST_ACTIVITY_COLUMNS)}
    from crm.clients c
    ${assignmentJoin}
    ${whereClause}
    order by c.created_at desc
    limit ${query.pageSize}
    offset ${safeOffset}
  `;

  return {
    items: rows.map(mapClientListRow),
    total,
    page: safePage,
    pageSize: query.pageSize,
    totalPages,
  };
}

async function listClientsPageFromDisk(
  userId: string,
  isMaster: boolean,
  query: NormalizedClientsPageQuery,
): Promise<ClientsPageResult> {
  const clients = await readClientsFromDisk();
  const visible = isMaster
    ? clients
    : clients.filter((client) => client.assignedUserIds.includes(userId));

  let filtered = query.search
    ? visible.filter((client) => matchesClientSearch(client, query.search))
    : visible;

  if (query.productIds.length > 0) {
    const allowed = new Set(query.productIds);
    filtered = filtered.filter((client) => allowed.has(client.productId));
  }

  if (query.statuses.length > 0) {
    const allowed = new Set(query.statuses);
    filtered = filtered.filter((client) => allowed.has(client.status));
  }

  if (query.createdFrom || query.createdTo) {
    filtered = filtered.filter((client) => {
      try {
        const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
          new Date(client.createdAt),
        );
        if (query.createdFrom && day < query.createdFrom) return false;
        if (query.createdTo && day > query.createdTo) return false;
        return true;
      } catch {
        return false;
      }
    });
  }

  if ((query.attendance !== "all" || query.schedule === "with") && filtered.length > 0) {
    const flags = await getClientActivityFlagsForClients(filtered.map((client) => client.id));
    filtered = filtered.filter((client) => {
      const activity = flags[client.id] ?? EMPTY_ACTIVITY_FLAGS;
      if (query.attendance === "with" && !activity.hasAttendance) return false;
      if (query.attendance === "without" && activity.hasAttendance) return false;
      if (query.schedule === "with" && !activity.hasSchedule) return false;
      return true;
    });
  }

  const sorted = [...filtered].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  const total = sorted.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(query.page, totalPages);
  const offset = (safePage - 1) * query.pageSize;
  const items = await enrichClientListItems(
    sorted.slice(offset, offset + query.pageSize).map(mapClientListItem),
  );

  return {
    items,
    total,
    page: safePage,
    pageSize: query.pageSize,
    totalPages,
  };
}

async function listClientsFromPostgres(userId: string, isMaster: boolean): Promise<ClientRecord[]> {
  const sql = await getSql();
  const rows = isMaster
    ? await sql<ClientRow[]>`
        select
          c.id,
          c.product_id,
          c.import_batch_id,
          c.status,
          c.data,
          c.distribution,
          c.display,
          c.created_at,
          coalesce(array_agg(a.user_id) filter (where a.user_id is not null), '{}') as assigned_user_ids
        from crm.clients c
        left join crm.client_assignments a on a.client_id = c.id
        group by c.id
        order by c.created_at desc
      `
    : await sql<ClientRow[]>`
        select
          c.id,
          c.product_id,
          c.import_batch_id,
          c.status,
          c.data,
          c.distribution,
          c.display,
          c.created_at,
          coalesce(array_agg(a.user_id) filter (where a.user_id is not null), '{}') as assigned_user_ids
        from crm.clients c
        inner join crm.client_assignments mine on mine.client_id = c.id and mine.user_id = ${userId}
        left join crm.client_assignments a on a.client_id = c.id
        group by c.id
        order by c.created_at desc
      `;

  return rows.map(mapClientRow);
}

async function insertClientsInPostgres(records: ClientRecord[]): Promise<void> {
  if (records.length === 0) return;
  const sql = await getSql();
  const now = new Date();

  const clientRows = records.map((record) => ({
    id: record.id,
    product_id: record.productId,
    import_batch_id: record.importBatchId,
    status: record.status,
    data: record.data,
    distribution: record.distribution,
    display: record.display,
    created_at: record.createdAt,
    updated_at: now,
  }));

  const assignmentRows = records.flatMap((record) =>
    record.assignedUserIds.map((userId) => ({
      client_id: record.id,
      user_id: userId,
    })),
  );

  await sql.begin(async (tx) => {
    await tx`
      insert into crm.clients ${tx(
        clientRows,
        "id",
        "product_id",
        "import_batch_id",
        "status",
        "data",
        "distribution",
        "display",
        "created_at",
        "updated_at",
      )}
    `;

    if (assignmentRows.length > 0) {
      await tx`
        insert into crm.client_assignments ${tx(assignmentRows, "client_id", "user_id")}
        on conflict do nothing
      `;
    }
  });
}

export async function resolveAssignedUserIds(distribution: LeadDistribution): Promise<string[]> {
  const users = await listAllUsers();
  const operational = users.filter((user) => user.role !== "master");

  if (distribution.type === "all") {
    return operational.map((user) => user.id);
  }

  if (distribution.type === "category") {
    const settings = await loadSystemSettingsFromDisk();
    const categorySet = new Set(distribution.categoryIds);
    return operational
      .filter((user) => categorySet.has(user.categoryId))
      .map((user) => user.id);
  }

  return distribution.userIds;
}

/** Dono do agendamento: preferir atendente da distribuição; senão fallback (quem importou). */
export async function resolveScheduleActor(
  assignedUserIds: string[],
  fallback?: { userId: string; userName: string },
): Promise<{ userId: string; userName: string } | null> {
  const users = await listAllUsers();
  for (const id of assignedUserIds) {
    const user = users.find((item) => item.id === id);
    if (user && user.role !== "master") {
      return { userId: user.id, userName: user.name };
    }
  }
  for (const id of assignedUserIds) {
    const user = users.find((item) => item.id === id);
    if (user) return { userId: user.id, userName: user.name };
  }
  const fallbackId = fallback?.userId?.trim();
  if (fallbackId) {
    return {
      userId: fallbackId,
      userName: fallback?.userName?.trim() || "Usuário",
    };
  }
  return null;
}

export function mapRowToClientData(
  row: Record<string, string>,
  columnMapping: Partial<Record<ClientFieldId, string>>,
): Partial<Record<ClientFieldId, string>> {
  const data: Partial<Record<ClientFieldId, string>> = {};
  for (const [fieldId, header] of Object.entries(columnMapping)) {
    if (!header) continue;
    const value = row[header]?.trim();
    if (value) data[fieldId as ClientFieldId] = value;
  }
  return data;
}

export async function importClients(payload: ImportClientsPayload): Promise<{ imported: number; batchId: string }> {
  const settings = await loadSystemSettingsFromDisk();
  const product = settings.products.find((item) => item.id === payload.productId);
  if (!product) throw new Error("Produto inválido.");

  for (const fieldId of product.requiredFieldIds) {
    if (!payload.columnMapping[fieldId]) {
      throw new Error(`Campo obrigatório não indexado: ${fieldId}`);
    }
  }

  const assignedUserIds = await resolveAssignedUserIds(payload.distribution);
  if (assignedUserIds.length === 0) {
    throw new Error("Nenhum usuário elegível para receber os leads.");
  }

  await assertClientDatabaseHasRoom(payload.rows.length);

  const batchId = payload.batchId?.trim() || `batch-${crypto.randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();

  const importedRecords: ClientRecord[] = payload.rows.map((row) => ({
    id: `client-${crypto.randomUUID().slice(0, 8)}`,
    productId: payload.productId,
    importBatchId: batchId,
    data: mapRowToClientData(row, payload.columnMapping),
    assignedUserIds,
    distribution: payload.distribution,
    display: payload.display,
    status: "novo",
    createdAt,
  }));

  await appendClientRecords(importedRecords);

  const scheduleContactDate = payload.scheduleContactDate?.trim();
  if (scheduleContactDate && /^\d{4}-\d{2}-\d{2}$/.test(scheduleContactDate)) {
    const actor = await resolveScheduleActor(assignedUserIds, {
      userId: payload.scheduleUserId?.trim() || "",
      userName: payload.scheduleUserName?.trim() || "Usuário",
    });
    if (actor) {
      await saveClientSchedulesBulk({
        clientIds: importedRecords.map((record) => record.id),
        userId: actor.userId,
        userName: actor.userName,
        contactDate: scheduleContactDate,
      });
    }
  }

  return { imported: importedRecords.length, batchId };
}

export async function appendClientRecords(records: ClientRecord[]): Promise<void> {
  if (records.length === 0) return;

  if (isDatabaseEnabled()) {
    await insertClientsInPostgres(records);
    return;
  }

  const existing = await readClientsFromDisk();
  await writeClientsToDisk([...existing, ...records]);
}

export async function createManualClient(payload: CreateManualClientPayload): Promise<ClientRecord> {
  const settings = await loadSystemSettingsFromDisk();
  const product = settings.products.find((item) => item.id === payload.productId);
  if (!product) throw new Error("Produto inválido.");

  const data: Partial<Record<ClientFieldId, string>> = {};
  for (const [fieldId, value] of Object.entries(payload.data)) {
    const trimmed = value?.trim();
    if (trimmed) data[fieldId as ClientFieldId] = trimmed;
  }

  for (const fieldId of product.requiredFieldIds) {
    if (!data[fieldId]) {
      throw new Error(`Campo obrigatório: ${clientFieldLabel(fieldId)}`);
    }
  }

  const assignedUserIds = await resolveAssignedUserIds(payload.distribution);
  if (assignedUserIds.length === 0) {
    throw new Error("Nenhum usuário elegível para receber o lead.");
  }

  await assertClientDatabaseHasRoom(1);

  const filledFieldIds = Object.keys(data) as ClientFieldId[];
  const record: ClientRecord = {
    id: `client-${crypto.randomUUID().slice(0, 8)}`,
    productId: payload.productId,
    importBatchId: `manual-${crypto.randomUUID().slice(0, 8)}`,
    data,
    assignedUserIds,
    distribution: payload.distribution,
    display: { mode: "table", visibleFieldIds: filledFieldIds },
    status: "novo",
    createdAt: new Date().toISOString(),
  };

  if (isDatabaseEnabled()) {
    await insertClientsInPostgres([record]);
  } else {
    const existing = await readClientsFromDisk();
    await writeClientsToDisk([...existing, record]);
  }

  const scheduleContactDate = payload.scheduleContactDate?.trim();
  if (scheduleContactDate && /^\d{4}-\d{2}-\d{2}$/.test(scheduleContactDate)) {
    const actor = await resolveScheduleActor(assignedUserIds, {
      userId: payload.scheduleUserId?.trim() || "",
      userName: payload.scheduleUserName?.trim() || "Usuário",
    });
    if (actor) {
      await saveClientSchedulesBulk({
        clientIds: [record.id],
        userId: actor.userId,
        userName: actor.userName,
        contactDate: scheduleContactDate,
      });
    }
  }

  return record;
}

async function getClientFromPostgres(
  clientId: string,
  userId: string,
  isMaster: boolean,
): Promise<ClientRecord | null> {
  const sql = await getSql();
  const rows = isMaster
    ? await sql<ClientRow[]>`
        select
          c.id,
          c.product_id,
          c.import_batch_id,
          c.status,
          c.data,
          c.distribution,
          c.display,
          c.created_at,
          coalesce(array_agg(a.user_id) filter (where a.user_id is not null), '{}') as assigned_user_ids
        from crm.clients c
        left join crm.client_assignments a on a.client_id = c.id
        where c.id = ${clientId}
        group by c.id
        limit 1
      `
    : await sql<ClientRow[]>`
        select
          c.id,
          c.product_id,
          c.import_batch_id,
          c.status,
          c.data,
          c.distribution,
          c.display,
          c.created_at,
          coalesce(array_agg(a.user_id) filter (where a.user_id is not null), '{}') as assigned_user_ids
        from crm.clients c
        inner join crm.client_assignments mine on mine.client_id = c.id and mine.user_id = ${userId}
        left join crm.client_assignments a on a.client_id = c.id
        where c.id = ${clientId}
        group by c.id
        limit 1
      `;

  const row = rows[0];
  return row ? mapClientRow(row) : null;
}

export async function getClientByIdForUser(
  clientId: string,
  userId: string,
  isMaster: boolean,
): Promise<ClientRecord | null> {
  if (!clientId.trim()) return null;

  if (isDatabaseEnabled()) {
    return getClientFromPostgres(clientId, userId, isMaster);
  }

  const clients = await readClientsFromDisk();
  const client = clients.find((item) => item.id === clientId);
  if (!client) return null;
  if (!isMaster && !client.assignedUserIds.includes(userId)) return null;
  return client;
}

export async function listClientsForUser(userId: string, isMaster: boolean): Promise<ClientRecord[]> {
  if (isDatabaseEnabled()) {
    return listClientsFromPostgres(userId, isMaster);
  }

  const clients = await readClientsFromDisk();
  if (isMaster) return clients;
  return clients.filter((client) => client.assignedUserIds.includes(userId));
}

export async function listClientsPageForUser(
  userId: string,
  isMaster: boolean,
  query: ClientsPageQuery = {},
): Promise<ClientsPageResult> {
  const normalized = normalizeClientsPageQuery(query);
  if (isDatabaseEnabled()) {
    return listClientsPageFromPostgres(userId, isMaster, normalized);
  }
  return listClientsPageFromDisk(userId, isMaster, normalized);
}

function matchesAgendaFilter(contactDate: string, filter: AgendaFilter): boolean {
  const today = localDateString();
  if (filter === "all") return true;
  if (filter === "today") return contactDate === today;
  if (filter === "tomorrow") return contactDate === localTomorrowString();
  if (filter === "overdue") return contactDate < today;
  return false;
}

function matchesAgendaListQuery(
  contactDate: string,
  status: string,
  query: Required<Pick<AgendaListQuery, "filter" | "pendingOnly">>,
): boolean {
  if (!matchesAgendaFilter(contactDate, query.filter)) return false;
  if (query.pendingOnly && isConcludedAttendanceStatus(status)) return false;
  return true;
}

async function listScheduledClientsFromPostgres(
  userId: string,
  isMaster: boolean,
  query: Required<Pick<AgendaListQuery, "filter" | "pendingOnly">>,
): Promise<ClientListItem[]> {
  const sql = await getSql();
  const today = localDateString();
  const tomorrow = localTomorrowString();
  const { filter, pendingOnly } = query;

  const dateClause =
    filter === "today"
      ? sql`sch.contact_date = ${today}::date`
      : filter === "tomorrow"
        ? sql`sch.contact_date = ${tomorrow}::date`
        : filter === "overdue"
          ? sql`sch.contact_date < ${today}::date`
          : sql`true`;

  const statusClause = pendingOnly ? sql`c.status <> 'concluido'` : sql`true`;

  const productIdsSelect = sql`
    (
      select coalesce(array_agg(distinct pid), array[c.product_id])
      from (
        select c.product_id as pid
        union
        select cp.product_id from crm.client_products cp where cp.client_id = c.id
      ) products
    ) as product_ids
  `;

  const scopeClause = isMaster
    ? sql`true`
    : sql`(
        sch.user_id = ${userId}
        or exists (
          select 1 from crm.client_assignments mine
          where mine.client_id = c.id and mine.user_id = ${userId}
        )
      )`;

  const rows = await sql<ClientListRow[]>`
    select
      c.id,
      c.product_id,
      ${productIdsSelect},
      c.status,
      c.data->>'nome' as nome,
      c.data->>'cpf' as cpf,
      c.data->>'telefone' as telefone,
      c.distribution,
      c.display,
      c.created_at,
      ${sql.unsafe(CLIENT_LIST_ACTIVITY_COLUMNS)}
    from crm.client_schedules sch
    inner join crm.clients c on c.id = sch.client_id
    where ${dateClause} and ${statusClause} and ${scopeClause}
    order by sch.contact_date asc, c.data->>'nome' asc nulls last
  `;

  return rows.map(mapClientListRow);
}

async function listScheduledClientsFromDisk(
  userId: string,
  isMaster: boolean,
  query: Required<Pick<AgendaListQuery, "filter" | "pendingOnly">>,
): Promise<ClientListItem[]> {
  const clients = await listClientsForUser(userId, true);
  const items: ClientListItem[] = [];

  for (const client of clients) {
    const schedule = await getClientSchedule(client.id);
    if (!schedule) continue;
    if (
      !isMaster &&
      schedule.userId !== userId &&
      !client.assignedUserIds.includes(userId)
    ) {
      continue;
    }
    if (!matchesAgendaListQuery(schedule.contactDate, client.status, query)) continue;
    items.push(mapClientListItem(client));
  }

  return enrichClientListItems(
    items.sort((left, right) =>
      (left.nome ?? left.cpf ?? "").localeCompare(right.nome ?? right.cpf ?? "", "pt-BR"),
    ),
  );
}

function normalizeAgendaListQuery(query: AgendaListQuery = {}): Required<Pick<AgendaListQuery, "filter" | "pendingOnly">> {
  const filter =
    query.filter === "tomorrow" ||
    query.filter === "all" ||
    query.filter === "overdue" ||
    query.filter === "today"
      ? query.filter
      : "today";
  const pendingOnly = query.pendingOnly === true || filter === "overdue";
  return { filter, pendingOnly };
}

export async function listScheduledClientsForUser(
  userId: string,
  isMaster: boolean,
  query: AgendaListQuery = {},
): Promise<ClientListItem[]> {
  const normalized = normalizeAgendaListQuery(query);
  if (isDatabaseEnabled()) {
    return listScheduledClientsFromPostgres(userId, isMaster, normalized);
  }
  return listScheduledClientsFromDisk(userId, isMaster, normalized);
}

function normalizeRemarketingFilter(filter?: RemarketingFilter): RemarketingFilter {
  if (
    filter === "week" ||
    filter === "next15" ||
    filter === "next30" ||
    filter === "today"
  ) {
    return filter;
  }
  return "today";
}

type RemarketingListRow = ClientListRow & {
  contact_date: string | Date;
};

function mapRemarketingListRow(row: RemarketingListRow): RemarketingListItem {
  const contactDate =
    typeof row.contact_date === "string"
      ? row.contact_date.slice(0, 10)
      : localDateString(row.contact_date);
  return {
    ...mapClientListRow(row),
    contactDate,
  };
}

async function listRemarketingClientsFromPostgres(
  userId: string,
  isMaster: boolean,
  filter: RemarketingFilter,
): Promise<RemarketingListItem[]> {
  const sql = await getSql();
  const { from, to } = resolveRemarketingDateRange(filter);
  const dateClause = sql`sch.contact_date >= ${from}::date and sch.contact_date <= ${to}::date`;

  const productIdsSelect = sql`
    (
      select coalesce(array_agg(distinct pid), array[c.product_id])
      from (
        select c.product_id as pid
        union
        select cp.product_id from crm.client_products cp where cp.client_id = c.id
      ) products
    ) as product_ids
  `;

  const scopeClause = isMaster
    ? sql`true`
    : sql`(
        sch.user_id = ${userId}
        or exists (
          select 1 from crm.client_assignments mine
          where mine.client_id = c.id and mine.user_id = ${userId}
        )
      )`;

  const rows = await sql<RemarketingListRow[]>`
    select
      c.id,
      c.product_id,
      ${productIdsSelect},
      c.status,
      c.data->>'nome' as nome,
      c.data->>'cpf' as cpf,
      c.data->>'telefone' as telefone,
      c.distribution,
      c.display,
      c.created_at,
      sch.contact_date,
      ${sql.unsafe(CLIENT_LIST_ACTIVITY_COLUMNS)}
    from crm.client_schedules sch
    inner join crm.clients c on c.id = sch.client_id
    where ${dateClause} and ${scopeClause}
    order by sch.contact_date asc, c.data->>'nome' asc nulls last
  `;

  return rows.map(mapRemarketingListRow);
}

async function listRemarketingClientsFromDisk(
  userId: string,
  isMaster: boolean,
  filter: RemarketingFilter,
): Promise<RemarketingListItem[]> {
  const { from, to } = resolveRemarketingDateRange(filter);
  const clients = await listClientsForUser(userId, true);
  const items: RemarketingListItem[] = [];

  for (const client of clients) {
    const schedule = await getClientSchedule(client.id);
    if (!schedule) continue;
    if (
      !isMaster &&
      schedule.userId !== userId &&
      !client.assignedUserIds.includes(userId)
    ) {
      continue;
    }
    if (schedule.contactDate < from || schedule.contactDate > to) continue;
    items.push({
      ...mapClientListItem(client),
      contactDate: schedule.contactDate,
    });
  }

  const contactById = new Map(items.map((item) => [item.id, item.contactDate]));
  const enriched = await enrichClientListItems(items);
  return enriched
    .map((item) => ({
      ...item,
      contactDate: contactById.get(item.id) ?? "",
    }))
    .filter((item) => item.contactDate)
    .sort((left, right) => {
      const byDate = left.contactDate.localeCompare(right.contactDate);
      if (byDate !== 0) return byDate;
      return (left.nome ?? left.cpf ?? "").localeCompare(right.nome ?? right.cpf ?? "", "pt-BR");
    });
}

export async function listRemarketingClientsForUser(
  userId: string,
  isMaster: boolean,
  query: RemarketingListQuery = {},
): Promise<RemarketingListItem[]> {
  const filter = normalizeRemarketingFilter(query.filter);
  if (isDatabaseEnabled()) {
    return listRemarketingClientsFromPostgres(userId, isMaster, filter);
  }
  return listRemarketingClientsFromDisk(userId, isMaster, filter);
}

/** Alinhado ao teto de ações em lote — Comercial 01+ tem >800 leads; cortar escondia status. */
const KANBAN_BOARD_LIMIT = 5000;

type KanbanListRow = ClientListRow & {
  contact_date: string | Date | null;
};

function mapKanbanListRow(row: KanbanListRow): KanbanListItem {
  let contactDate: string | null = null;
  if (row.contact_date) {
    contactDate =
      typeof row.contact_date === "string"
        ? row.contact_date.slice(0, 10)
        : localDateString(row.contact_date);
  }
  return {
    ...mapClientListRow(row),
    contactDate,
  };
}

async function listKanbanClientsFromPostgres(
  userId: string,
  isMaster: boolean,
): Promise<KanbanListItem[]> {
  const sql = await getSql();
  const productIdsSelect = sql`
    (
      select coalesce(array_agg(distinct pid), array[c.product_id])
      from (
        select c.product_id as pid
        union
        select cp.product_id from crm.client_products cp where cp.client_id = c.id
      ) products
    ) as product_ids
  `;

  const assignmentJoin = isMaster
    ? sql``
    : sql`inner join crm.client_assignments mine on mine.client_id = c.id and mine.user_id = ${userId}`;

  const rows = await sql<KanbanListRow[]>`
    select
      c.id,
      c.product_id,
      ${productIdsSelect},
      c.status,
      c.data->>'nome' as nome,
      c.data->>'cpf' as cpf,
      c.data->>'telefone' as telefone,
      c.distribution,
      c.display,
      c.created_at,
      ksch.contact_date,
      ${sql.unsafe(CLIENT_LIST_ACTIVITY_COLUMNS)}
    from crm.clients c
    ${assignmentJoin}
    left join lateral (
      select s.contact_date
      from crm.client_schedules s
      where s.client_id = c.id
      order by s.contact_date desc nulls last
      limit 1
    ) ksch on true
    order by coalesce(ksch.contact_date, (c.created_at at time zone 'America/Sao_Paulo')::date) desc nulls last
    limit ${KANBAN_BOARD_LIMIT}
  `;

  return rows.map(mapKanbanListRow);
}

async function listKanbanClientsFromDisk(
  userId: string,
  isMaster: boolean,
): Promise<KanbanListItem[]> {
  const clients = await listClientsForUser(userId, isMaster);
  const items: KanbanListItem[] = [];

  for (const client of clients.slice(0, KANBAN_BOARD_LIMIT)) {
    const schedule = await getClientSchedule(client.id);
    items.push({
      ...mapClientListItem(client),
      contactDate: schedule?.contactDate ?? null,
    });
  }

  const enriched = await enrichClientListItems(items);
  const contactById = new Map(items.map((item) => [item.id, item.contactDate]));
  return enriched
    .map((item) => ({
      ...item,
      contactDate: contactById.get(item.id) ?? null,
    }))
    .sort((left, right) => {
      const leftDate = left.contactDate ?? createdAtToLocalDate(left.createdAt) ?? "";
      const rightDate = right.contactDate ?? createdAtToLocalDate(right.createdAt) ?? "";
      return rightDate.localeCompare(leftDate);
    });
}

/** Clientes do usuário (atribuição / master) para o quadro Kanban. */
export async function listKanbanClientsForUser(
  userId: string,
  isMaster: boolean,
): Promise<KanbanListItem[]> {
  if (isDatabaseEnabled()) {
    return listKanbanClientsFromPostgres(userId, isMaster);
  }
  return listKanbanClientsFromDisk(userId, isMaster);
}

async function getAgendaAlertCountsFromPostgres(
  userId: string,
  isMaster: boolean,
): Promise<AgendaAlertCounts> {
  const sql = await getSql();
  const today = localDateString();
  const scopeClause = isMaster
    ? sql`true`
    : sql`(
        sch.user_id = ${userId}
        or exists (
          select 1 from crm.client_assignments mine
          where mine.client_id = c.id and mine.user_id = ${userId}
        )
      )`;

  const todayRows = await sql<{ total: number }[]>`
    select count(*)::int as total
    from crm.client_schedules sch
    inner join crm.clients c on c.id = sch.client_id
    where sch.contact_date = ${today}::date
      and c.status <> 'concluido'
      and ${scopeClause}
  `;

  const overdueRows = await sql<{ total: number }[]>`
    select count(*)::int as total
    from crm.client_schedules sch
    inner join crm.clients c on c.id = sch.client_id
    where sch.contact_date < ${today}::date
      and c.status <> 'concluido'
      and ${scopeClause}
  `;

  return {
    todayPending: todayRows[0]?.total ?? 0,
    overduePending: overdueRows[0]?.total ?? 0,
  };
}

async function getAgendaAlertCountsFromDisk(
  userId: string,
  isMaster: boolean,
): Promise<AgendaAlertCounts> {
  const clients = await listClientsForUser(userId, true);
  let todayPending = 0;
  let overduePending = 0;

  for (const client of clients) {
    const schedule = await getClientSchedule(client.id);
    if (!schedule || isConcludedAttendanceStatus(client.status)) continue;
    if (
      !isMaster &&
      schedule.userId !== userId &&
      !client.assignedUserIds.includes(userId)
    ) {
      continue;
    }
    if (matchesAgendaFilter(schedule.contactDate, "today")) todayPending += 1;
    if (matchesAgendaFilter(schedule.contactDate, "overdue")) overduePending += 1;
  }

  return { todayPending, overduePending };
}

export async function getAgendaAlertCountsForUser(
  userId: string,
  isMaster: boolean,
): Promise<AgendaAlertCounts> {
  if (isDatabaseEnabled()) {
    return getAgendaAlertCountsFromPostgres(userId, isMaster);
  }
  return getAgendaAlertCountsFromDisk(userId, isMaster);
}

async function getDashboardSummaryFromPostgres(
  userId: string,
  isMaster: boolean,
): Promise<DashboardSummary> {
  const sql = await getSql();
  const today = localDateString();
  const assignmentJoin = isMaster
    ? sql``
    : sql`inner join crm.client_assignments mine on mine.client_id = c.id and mine.user_id = ${userId}`;

  const productIdsSelect = sql`
    (
      select coalesce(array_agg(distinct pid), array[c.product_id])
      from (
        select c.product_id as pid
        union
        select cp.product_id from crm.client_products cp where cp.client_id = c.id
      ) products
    ) as product_ids
  `;

  const [totals] = await sql<
    {
      total: number;
      leads_today: number;
      open_leads: number;
      concluded: number;
      lost: number;
    }[]
  >`
    select
      count(*)::int as total,
      count(*) filter (
        where ((c.created_at at time zone 'America/Sao_Paulo')::date = ${today}::date)
      )::int as leads_today,
      count(*) filter (
        where c.status not in ('concluido', 'perdido')
      )::int as open_leads,
      count(*) filter (where c.status = 'concluido')::int as concluded,
      count(*) filter (where c.status = 'perdido')::int as lost
    from crm.clients c
    ${assignmentJoin}
  `;

  const statusRows = await sql<{ status: string; count: number }[]>`
    select c.status, count(*)::int as count
    from crm.clients c
    ${assignmentJoin}
    group by c.status
    order by count desc
  `;

  const recentRows = await sql<ClientListRow[]>`
    select
      c.id,
      c.product_id,
      ${productIdsSelect},
      c.status,
      c.data->>'nome' as nome,
      c.data->>'cpf' as cpf,
      c.data->>'telefone' as telefone,
      c.distribution,
      c.display,
      c.created_at,
      ${sql.unsafe(CLIENT_LIST_ACTIVITY_COLUMNS)}
    from crm.clients c
    ${assignmentJoin}
    order by c.created_at desc
    limit 8
  `;

  const [agenda, agendaToday] = await Promise.all([
    getAgendaAlertCountsFromPostgres(userId, isMaster),
    listScheduledClientsFromPostgres(userId, isMaster, {
      filter: "today",
      pendingOnly: true,
    }),
  ]);

  return {
    clientTotal: totals?.total ?? 0,
    leadsToday: totals?.leads_today ?? 0,
    openLeads: totals?.open_leads ?? 0,
    concluded: totals?.concluded ?? 0,
    lost: totals?.lost ?? 0,
    agendaTodayPending: agenda.todayPending,
    agendaOverduePending: agenda.overduePending,
    byStatus: statusRows.map((row) => ({ statusId: row.status, count: row.count })),
    recentClients: recentRows.map(mapClientListRow),
    agendaToday: agendaToday.slice(0, 8),
  };
}

async function getDashboardSummaryFromDisk(
  userId: string,
  isMaster: boolean,
): Promise<DashboardSummary> {
  const today = localDateString();
  const clients = await listClientsForUser(userId, isMaster);
  const withFlags = await enrichClientListItems(clients.map(mapClientListItem));

  let leadsToday = 0;
  let openLeads = 0;
  let concluded = 0;
  let lost = 0;
  const statusMap = new Map<string, number>();

  for (const client of withFlags) {
    const day = createdAtToLocalDate(client.createdAt);
    if (day === today) leadsToday += 1;
    if (client.status === "concluido") concluded += 1;
    else if (client.status === "perdido") lost += 1;
    else openLeads += 1;
    statusMap.set(client.status, (statusMap.get(client.status) ?? 0) + 1);
  }

  const [agenda, agendaToday] = await Promise.all([
    getAgendaAlertCountsFromDisk(userId, isMaster),
    listScheduledClientsFromDisk(userId, isMaster, {
      filter: "today",
      pendingOnly: true,
    }),
  ]);

  return {
    clientTotal: withFlags.length,
    leadsToday,
    openLeads,
    concluded,
    lost,
    agendaTodayPending: agenda.todayPending,
    agendaOverduePending: agenda.overduePending,
    byStatus: [...statusMap.entries()]
      .map(([statusId, count]) => ({ statusId, count }))
      .sort((a, b) => b.count - a.count),
    recentClients: [...withFlags]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8),
    agendaToday: agendaToday.slice(0, 8),
  };
}

/** Indicadores do Dashboard restritos ao usuário logado (ou todos se master). */
export async function getDashboardSummaryForUser(
  userId: string,
  isMaster: boolean,
): Promise<DashboardSummary> {
  if (isDatabaseEnabled()) {
    return getDashboardSummaryFromPostgres(userId, isMaster);
  }
  return getDashboardSummaryFromDisk(userId, isMaster);
}

export async function updateClientStatus(
  clientId: string,
  userId: string,
  isMaster: boolean,
  status: string,
): Promise<ClientRecord> {
  const trimmed = status.trim();
  if (!trimmed) throw new Error("Status inválido.");

  const client = await getClientByIdForUser(clientId, userId, isMaster);
  if (!client) throw new Error("Cliente não encontrado.");

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    await sql`
      update crm.clients
      set status = ${trimmed}
      where id = ${clientId}
    `;
    return { ...client, status: trimmed };
  }

  const clients = await readClientsFromDisk();
  const next = clients.map((item) =>
    item.id === clientId ? { ...item, status: trimmed } : item,
  );
  await writeClientsToDisk(next);
  return { ...client, status: trimmed };
}

/** Vincula um produto extra sem duplicar o cadastro do cliente. */
export async function addProductToClient(
  clientId: string,
  userId: string,
  isMaster: boolean,
  productId: string,
): Promise<string[]> {
  const normalizedProductId = productId.trim();
  if (!normalizedProductId) throw new Error("Selecione um produto.");

  const client = await getClientByIdForUser(clientId, userId, isMaster);
  if (!client) throw new Error("Cliente não encontrado.");

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    const product = await sql<{ id: string }[]>`
      select id from crm.products where id = ${normalizedProductId} limit 1
    `;
    if (!product[0]) throw new Error("Produto não encontrado.");

    // Preserva também o produto principal na relação multi-produto.
    await sql`
      insert into crm.client_products (client_id, product_id)
      values
        (${clientId}, ${client.productId}),
        (${clientId}, ${normalizedProductId})
      on conflict do nothing
    `;
    const rows = await sql<{ product_id: string }[]>`
      select product_id
      from crm.client_products
      where client_id = ${clientId}
      order by created_at, product_id
    `;
    return rows.map((row) => row.product_id);
  }

  const clients = await readClientsFromDisk();
  const current = [...new Set([client.productId, ...(client.productIds ?? []), normalizedProductId])];
  await writeClientsToDisk(
    clients.map((item) => (item.id === clientId ? { ...item, productIds: current } : item)),
  );
  return current;
}
