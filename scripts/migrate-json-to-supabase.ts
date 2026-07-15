/**
 * Migração única: data/*.json → Supabase (schema crm).
 * Uso: bun run scripts/migrate-json-to-supabase.ts
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSql } from "../src/lib/db/postgres";
import { saveSystemSettingsToDisk } from "../src/lib/config/settings.repository";
import { appendClientRecords } from "../src/lib/clients/clients.repository";
import { createUser } from "../src/lib/users/user.repository";
import type { SystemSettings } from "../src/lib/config/settings-types";
import type { ClientRecord } from "../src/lib/clients/client.types";
import type { StoredUser } from "../src/lib/users/user.types";
import { MASTER_USER_ID } from "../src/lib/auth/master-user";

const DATA_DIR = join(process.cwd(), "data");

async function readJson<T>(fileName: string): Promise<T | null> {
  try {
    const raw = await readFile(join(DATA_DIR, fileName), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const sql = await getSql();
const [{ users }] = await sql<{ users: string }[]>`select count(*)::text as users from crm.users`;
const [{ clients }] = await sql<{ clients: string }[]>`
  select count(*)::text as clients from crm.clients
`;

if (Number(users) > 1 || Number(clients) > 0) {
  console.log("Banco já contém dados — migração ignorada.");
  process.exit(0);
}

const settings = await readJson<SystemSettings>("system-settings.json");
if (settings) {
  await saveSystemSettingsToDisk(settings);
  console.log("OK settings");
}

const usersFile = await readJson<StoredUser[]>("users.json");
if (usersFile?.length) {
  for (const user of usersFile.filter((item) => item.id !== MASTER_USER_ID)) {
    await createUser(user);
  }
  console.log(`OK users (${usersFile.length})`);
}

const clientsFile = await readJson<ClientRecord[]>("clients.json");
if (clientsFile?.length) {
  const batchSize = 500;
  for (let index = 0; index < clientsFile.length; index += batchSize) {
    await appendClientRecords(clientsFile.slice(index, index + batchSize));
    console.log(`OK clients ${Math.min(index + batchSize, clientsFile.length)}/${clientsFile.length}`);
  }
}

console.log("Migração concluída.");
