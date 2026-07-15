import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

function loadDatabaseUrl(): string {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index < 0) continue;
      env[trimmed.slice(0, index)] = trimmed.slice(index + 1).trim();
    }
  } catch {
    // ignore
  }
  const url = env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL não encontrada em .env.local");
  return url;
}

const clientsFile = join(process.cwd(), "data", "clients.json");

async function purgePostgres(): Promise<{ clients: number; assignments: number; jobs: number }> {
  const sql = postgres(loadDatabaseUrl(), { ssl: "require", prepare: false, max: 1 });

  const before = await sql<{ clients: number; assignments: number; jobs: number }[]>`
    select
      (select count(*)::int from crm.clients) as clients,
      (select count(*)::int from crm.client_assignments) as assignments,
      (select count(*)::int from crm.import_jobs) as jobs
  `;

  await sql`delete from crm.client_assignments`;
  await sql`delete from crm.clients`;
  await sql`delete from crm.import_jobs`;

  const removed = before[0] ?? { clients: 0, assignments: 0, jobs: 0 };
  await sql.end();
  return removed;
}

function purgeJsonFallback(): number {
  if (!existsSync(clientsFile)) return 0;
  const raw = readFileSync(clientsFile, "utf8");
  const parsed = JSON.parse(raw) as unknown[];
  const count = Array.isArray(parsed) ? parsed.length : 0;
  writeFileSync(clientsFile, "[]\n", "utf8");
  return count;
}

const removed = await purgePostgres();
const jsonRemoved = purgeJsonFallback();

console.log("Removido do Supabase:");
console.log("  clientes:", removed.clients);
console.log("  atribuições:", removed.assignments);
console.log("  jobs de importação:", removed.jobs);
console.log("Removido do JSON local:", jsonRemoved);
console.log("OK — base de clientes zerada.");
