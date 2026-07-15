import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgendaFilter, AgendaItem, ClientRecord, ClientScheduleRecord } from "@/lib/clients/client.types";
import { localDateString, localTomorrowString } from "@/lib/dates/local-date";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";

const DATA_DIR = join(process.cwd(), "data");
const SCHEDULES_FILE = join(DATA_DIR, "client-schedules.json");

type ScheduleRow = {
  id: string;
  client_id: string;
  user_id: string;
  user_name: string;
  contact_date: string;
  created_at: Date;
  updated_at: Date;
};

function mapScheduleRow(row: ScheduleRow): ClientScheduleRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    userId: row.user_id,
    userName: row.user_name,
    contactDate: row.contact_date,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function readSchedulesFromDisk(): Promise<ClientScheduleRecord[]> {
  try {
    const raw = await readFile(SCHEDULES_FILE, "utf8");
    const parsed = JSON.parse(raw) as ClientScheduleRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSchedulesToDisk(records: ClientScheduleRecord[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SCHEDULES_FILE, JSON.stringify(records, null, 2), "utf8");
}

export async function getClientSchedule(clientId: string): Promise<ClientScheduleRecord | null> {
  if (isDatabaseEnabled()) {
    const sql = await getSql();
    const rows = await sql<ScheduleRow[]>`
      select id, client_id, user_id, user_name, contact_date::text, created_at, updated_at
      from crm.client_schedules
      where client_id = ${clientId}
      limit 1
    `;
    return rows[0] ? mapScheduleRow(rows[0]) : null;
  }

  const records = await readSchedulesFromDisk();
  return records.find((record) => record.clientId === clientId) ?? null;
}

export async function saveClientSchedule(input: {
  clientId: string;
  userId: string;
  userName: string;
  contactDate: string;
}): Promise<ClientScheduleRecord> {
  const contactDate = input.contactDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contactDate)) {
    throw new Error("Data de contato inválida.");
  }

  const now = new Date().toISOString();
  const existing = await getClientSchedule(input.clientId);
  const record: ClientScheduleRecord = {
    id: existing?.id ?? `sch-${crypto.randomUUID().slice(0, 8)}`,
    clientId: input.clientId,
    userId: input.userId,
    userName: input.userName,
    contactDate,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    const rows = await sql<ScheduleRow[]>`
      insert into crm.client_schedules (
        id, client_id, user_id, user_name, contact_date, created_at, updated_at
      ) values (
        ${record.id},
        ${record.clientId},
        ${record.userId},
        ${record.userName},
        ${contactDate},
        ${record.createdAt},
        ${now}
      )
      on conflict (client_id) do update set
        user_id = excluded.user_id,
        user_name = excluded.user_name,
        contact_date = excluded.contact_date,
        updated_at = excluded.updated_at
      returning id, client_id, user_id, user_name, contact_date::text, created_at, updated_at
    `;
    return mapScheduleRow(rows[0]!);
  }

  const records = await readSchedulesFromDisk().then((items) =>
    items.filter((item) => item.clientId !== input.clientId),
  );
  await writeSchedulesToDisk([record, ...records]);
  return record;
}

/** Agenda o mesmo contato para vários clientes (importação / lote). */
export async function saveClientSchedulesBulk(input: {
  clientIds: string[];
  userId: string;
  userName: string;
  contactDate: string;
}): Promise<number> {
  const contactDate = input.contactDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contactDate)) {
    throw new Error("Data de contato inválida.");
  }
  const clientIds = [...new Set(input.clientIds.map((id) => id.trim()).filter(Boolean))];
  if (clientIds.length === 0) return 0;

  const now = new Date().toISOString();

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    const chunkSize = 500;
    for (let offset = 0; offset < clientIds.length; offset += chunkSize) {
      const chunk = clientIds.slice(offset, offset + chunkSize);
      const rows = chunk.map((clientId) => ({
        id: `sch-${crypto.randomUUID().slice(0, 8)}`,
        client_id: clientId,
        user_id: input.userId,
        user_name: input.userName,
        contact_date: contactDate,
        created_at: now,
        updated_at: now,
      }));
      await sql`
        insert into crm.client_schedules ${sql(rows)}
        on conflict (client_id) do update set
          user_id = excluded.user_id,
          user_name = excluded.user_name,
          contact_date = excluded.contact_date,
          updated_at = excluded.updated_at
      `;
    }
    return clientIds.length;
  }

  const existing = await readSchedulesFromDisk();
  const without = existing.filter((item) => !clientIds.includes(item.clientId));
  const created = clientIds.map((clientId) => {
    const previous = existing.find((item) => item.clientId === clientId);
    return {
      id: previous?.id ?? `sch-${crypto.randomUUID().slice(0, 8)}`,
      clientId,
      userId: input.userId,
      userName: input.userName,
      contactDate,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    } satisfies ClientScheduleRecord;
  });
  await writeSchedulesToDisk([...created, ...without]);
  return clientIds.length;
}

type AgendaRow = {
  schedule_id: string;
  client_id: string;
  contact_date: string;
  scheduled_by: string;
  updated_at: Date;
  product_id: string;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  whatsapp: string | null;
};

function mapAgendaRow(row: AgendaRow): AgendaItem {
  return {
    scheduleId: row.schedule_id,
    clientId: row.client_id,
    contactDate: row.contact_date,
    scheduledBy: row.scheduled_by,
    updatedAt: row.updated_at.toISOString(),
    productId: row.product_id,
    nome: row.nome,
    cpf: row.cpf,
    telefone: row.telefone,
    whatsapp: row.whatsapp,
  };
}

function matchesAgendaFilter(contactDate: string, filter: AgendaFilter): boolean {
  if (filter === "all") return true;
  if (filter === "today") return contactDate === localDateString();
  return contactDate === localTomorrowString();
}

async function listAgendaFromDisk(
  userId: string,
  isMaster: boolean,
  filter: AgendaFilter,
  clients: ClientRecord[],
): Promise<AgendaItem[]> {
  const schedules = await readSchedulesFromDisk();
  const clientMap = new Map(clients.map((client) => [client.id, client]));

  return schedules
    .filter((schedule) => matchesAgendaFilter(schedule.contactDate, filter))
    .map((schedule) => {
      const client = clientMap.get(schedule.clientId);
      if (!client) return null;
      if (!isMaster && !client.assignedUserIds.includes(userId)) return null;
      return {
        scheduleId: schedule.id,
        clientId: schedule.clientId,
        contactDate: schedule.contactDate,
        scheduledBy: schedule.userName,
        updatedAt: schedule.updatedAt,
        productId: client.productId,
        nome: client.data.nome ?? null,
        cpf: client.data.cpf ?? null,
        telefone: client.data.telefone ?? null,
        whatsapp: client.data.whatsapp ?? null,
      } satisfies AgendaItem;
    })
    .filter((item): item is AgendaItem => item !== null)
    .sort((left, right) => {
      const byDate = left.contactDate.localeCompare(right.contactDate);
      if (byDate !== 0) return byDate;
      return (left.nome ?? left.cpf ?? "").localeCompare(right.nome ?? right.cpf ?? "", "pt-BR");
    });
}

async function listAgendaFromPostgres(
  userId: string,
  isMaster: boolean,
  filter: AgendaFilter,
): Promise<AgendaItem[]> {
  const sql = await getSql();
  const today = localDateString();
  const tomorrow = localTomorrowString();

  const rows = isMaster
    ? filter === "today"
      ? await sql<AgendaRow[]>`
          select
            sch.id as schedule_id,
            sch.client_id,
            sch.contact_date::text,
            sch.user_name as scheduled_by,
            sch.updated_at,
            c.product_id,
            c.data->>'nome' as nome,
            c.data->>'cpf' as cpf,
            c.data->>'telefone' as telefone,
            c.data->>'whatsapp' as whatsapp
          from crm.client_schedules sch
          inner join crm.clients c on c.id = sch.client_id
          where sch.contact_date = ${today}::date
          order by sch.contact_date asc, c.data->>'nome' asc nulls last
        `
      : filter === "tomorrow"
        ? await sql<AgendaRow[]>`
            select
              sch.id as schedule_id,
              sch.client_id,
              sch.contact_date::text,
              sch.user_name as scheduled_by,
              sch.updated_at,
              c.product_id,
              c.data->>'nome' as nome,
              c.data->>'cpf' as cpf,
              c.data->>'telefone' as telefone,
              c.data->>'whatsapp' as whatsapp
            from crm.client_schedules sch
            inner join crm.clients c on c.id = sch.client_id
            where sch.contact_date = ${tomorrow}::date
            order by sch.contact_date asc, c.data->>'nome' asc nulls last
          `
        : await sql<AgendaRow[]>`
            select
              sch.id as schedule_id,
              sch.client_id,
              sch.contact_date::text,
              sch.user_name as scheduled_by,
              sch.updated_at,
              c.product_id,
              c.data->>'nome' as nome,
              c.data->>'cpf' as cpf,
              c.data->>'telefone' as telefone,
              c.data->>'whatsapp' as whatsapp
            from crm.client_schedules sch
            inner join crm.clients c on c.id = sch.client_id
            order by sch.contact_date asc, c.data->>'nome' asc nulls last
          `
    : filter === "today"
      ? await sql<AgendaRow[]>`
          select
            sch.id as schedule_id,
            sch.client_id,
            sch.contact_date::text,
            sch.user_name as scheduled_by,
            sch.updated_at,
            c.product_id,
            c.data->>'nome' as nome,
            c.data->>'cpf' as cpf,
            c.data->>'telefone' as telefone,
            c.data->>'whatsapp' as whatsapp
          from crm.client_schedules sch
          inner join crm.clients c on c.id = sch.client_id
          inner join crm.client_assignments mine on mine.client_id = c.id and mine.user_id = ${userId}
          where sch.contact_date = ${today}::date
          order by sch.contact_date asc, c.data->>'nome' asc nulls last
        `
      : filter === "tomorrow"
        ? await sql<AgendaRow[]>`
            select
              sch.id as schedule_id,
              sch.client_id,
              sch.contact_date::text,
              sch.user_name as scheduled_by,
              sch.updated_at,
              c.product_id,
              c.data->>'nome' as nome,
              c.data->>'cpf' as cpf,
              c.data->>'telefone' as telefone,
              c.data->>'whatsapp' as whatsapp
            from crm.client_schedules sch
            inner join crm.clients c on c.id = sch.client_id
            inner join crm.client_assignments mine on mine.client_id = c.id and mine.user_id = ${userId}
            where sch.contact_date = ${tomorrow}::date
            order by sch.contact_date asc, c.data->>'nome' asc nulls last
          `
        : await sql<AgendaRow[]>`
            select
              sch.id as schedule_id,
              sch.client_id,
              sch.contact_date::text,
              sch.user_name as scheduled_by,
              sch.updated_at,
              c.product_id,
              c.data->>'nome' as nome,
              c.data->>'cpf' as cpf,
              c.data->>'telefone' as telefone,
              c.data->>'whatsapp' as whatsapp
            from crm.client_schedules sch
            inner join crm.clients c on c.id = sch.client_id
            inner join crm.client_assignments mine on mine.client_id = c.id and mine.user_id = ${userId}
            order by sch.contact_date asc, c.data->>'nome' asc nulls last
          `;

  return rows.map(mapAgendaRow);
}

export async function listAgendaForUser(
  userId: string,
  isMaster: boolean,
  filter: AgendaFilter,
  clientsForDisk?: ClientRecord[],
): Promise<AgendaItem[]> {
  if (isDatabaseEnabled()) {
    return listAgendaFromPostgres(userId, isMaster, filter);
  }

  if (!clientsForDisk) return [];
  return listAgendaFromDisk(userId, isMaster, filter, clientsForDisk);
}
