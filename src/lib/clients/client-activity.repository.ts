import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ClientActivityFlags } from "@/lib/clients/client.types";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";

const DATA_DIR = join(process.cwd(), "data");
const SCHEDULES_FILE = join(DATA_DIR, "client-schedules.json");
const ATTENDANCES_FILE = join(DATA_DIR, "client-attendances.json");
const ATTACHMENTS_INDEX_FILE = join(DATA_DIR, "client-attachments-index.json");

const emptyFlags = (): ClientActivityFlags => ({
  hasSchedule: false,
  hasAttendance: false,
  hasAttachments: false,
});

async function readJsonIds(filePath: string, clientIdKey: string): Promise<Set<string>> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, string>[];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .map((item) => item[clientIdKey])
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    );
  } catch {
    return new Set();
  }
}

export async function getClientActivityFlagsForClients(
  clientIds: string[],
): Promise<Record<string, ClientActivityFlags>> {
  const result: Record<string, ClientActivityFlags> = {};
  for (const clientId of clientIds) {
    result[clientId] = emptyFlags();
  }
  if (clientIds.length === 0) return result;

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    const [schedules, attendances, attachments] = await Promise.all([
      sql<{ client_id: string }[]>`
        select client_id from crm.client_schedules where client_id = any(${clientIds})
      `,
      sql<{ client_id: string }[]>`
        select distinct client_id from crm.client_attendances where client_id = any(${clientIds})
      `,
      sql<{ client_id: string }[]>`
        select distinct client_id from crm.client_attachments where client_id = any(${clientIds})
      `,
    ]);

    for (const row of schedules) {
      if (result[row.client_id]) result[row.client_id]!.hasSchedule = true;
    }
    for (const row of attendances) {
      if (result[row.client_id]) result[row.client_id]!.hasAttendance = true;
    }
    for (const row of attachments) {
      if (result[row.client_id]) result[row.client_id]!.hasAttachments = true;
    }
    return result;
  }

  const [scheduleIds, attendanceIds, attachmentIds] = await Promise.all([
    readJsonIds(SCHEDULES_FILE, "clientId"),
    readJsonIds(ATTENDANCES_FILE, "clientId"),
    readJsonIds(ATTACHMENTS_INDEX_FILE, "clientId"),
  ]);

  for (const clientId of clientIds) {
    result[clientId] = {
      hasSchedule: scheduleIds.has(clientId),
      hasAttendance: attendanceIds.has(clientId),
      hasAttachments: attachmentIds.has(clientId),
    };
  }

  return result;
}
