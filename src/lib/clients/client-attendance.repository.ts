import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ClientAttendanceRecord } from "@/lib/clients/client.types";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";

const DATA_DIR = join(process.cwd(), "data");
const ATTENDANCES_FILE = join(DATA_DIR, "client-attendances.json");

type AttendanceRow = {
  id: string;
  client_id: string;
  user_id: string;
  user_name: string;
  note: string;
  created_at: Date;
};

function mapAttendanceRow(row: AttendanceRow): ClientAttendanceRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    userId: row.user_id,
    userName: row.user_name,
    note: row.note,
    createdAt: row.created_at.toISOString(),
  };
}

async function readAttendancesFromDisk(): Promise<ClientAttendanceRecord[]> {
  try {
    const raw = await readFile(ATTENDANCES_FILE, "utf8");
    const parsed = JSON.parse(raw) as ClientAttendanceRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAttendancesToDisk(records: ClientAttendanceRecord[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ATTENDANCES_FILE, JSON.stringify(records, null, 2), "utf8");
}

export async function listClientAttendances(clientId: string): Promise<ClientAttendanceRecord[]> {
  if (isDatabaseEnabled()) {
    const sql = await getSql();
    const rows = await sql<AttendanceRow[]>`
      select id, client_id, user_id, user_name, note, created_at
      from crm.client_attendances
      where client_id = ${clientId}
      order by created_at desc
    `;
    return rows.map(mapAttendanceRow);
  }

  const records = await readAttendancesFromDisk();
  return records
    .filter((record) => record.clientId === clientId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createClientAttendance(input: {
  clientId: string;
  userId: string;
  userName: string;
  note: string;
}): Promise<ClientAttendanceRecord> {
  const note = input.note.trim();
  if (!note) throw new Error("Descreva o atendimento antes de registrar.");

  const record: ClientAttendanceRecord = {
    id: `att-${crypto.randomUUID().slice(0, 8)}`,
    clientId: input.clientId,
    userId: input.userId,
    userName: input.userName,
    note,
    createdAt: new Date().toISOString(),
  };

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    const rows = await sql<AttendanceRow[]>`
      insert into crm.client_attendances (id, client_id, user_id, user_name, note, created_at)
      values (
        ${record.id},
        ${record.clientId},
        ${record.userId},
        ${record.userName},
        ${record.note},
        ${record.createdAt}
      )
      returning id, client_id, user_id, user_name, note, created_at
    `;
    return mapAttendanceRow(rows[0]!);
  }

  const existing = await readAttendancesFromDisk();
  await writeAttendancesToDisk([record, ...existing]);
  return record;
}

export async function deleteClientAttendance(input: {
  attendanceId: string;
  actorUserId: string;
  isMaster: boolean;
}): Promise<void> {
  if (isDatabaseEnabled()) {
    const sql = await getSql();
    const rows = await sql<{ id: string; user_id: string }[]>`
      select id, user_id from crm.client_attendances where id = ${input.attendanceId} limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("Atendimento não encontrado.");
    if (!input.isMaster && row.user_id !== input.actorUserId) {
      throw new Error("Você só pode excluir atendimentos registrados por você.");
    }
    await sql`delete from crm.client_attendances where id = ${input.attendanceId}`;
    return;
  }

  const records = await readAttendancesFromDisk();
  const current = records.find((record) => record.id === input.attendanceId);
  if (!current) throw new Error("Atendimento não encontrado.");
  if (!input.isMaster && current.userId !== input.actorUserId) {
    throw new Error("Você só pode excluir atendimentos registrados por você.");
  }
  await writeAttendancesToDisk(records.filter((record) => record.id !== input.attendanceId));
}
