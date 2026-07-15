/**
 * Mantém apenas os N clientes mais antigos (por created_at) e remove o restante.
 * Uso: bun run scripts/trim-clients-to-limit.ts [limite]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
const LIMIT = Math.max(1, Number.parseInt(process.argv[2] ?? "", 10) || 0);
if (!LIMIT) {
  console.error("Uso: bun run scripts/trim-clients-to-limit.ts <limite>");
  console.error("Informe o limite explicitamente (não há teto padrão na aplicação).");
  process.exit(1);
}

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

function trimJsonFallback(limit: number): { before: number; after: number } {
  if (!existsSync(clientsFile)) return { before: 0, after: 0 };
  const raw = readFileSync(clientsFile, "utf8");
  const parsed = JSON.parse(raw) as unknown[];
  if (!Array.isArray(parsed)) return { before: 0, after: 0 };
  const before = parsed.length;
  if (before <= limit) return { before, after: before };
  const kept = parsed.slice(0, limit);
  writeFileSync(clientsFile, `${JSON.stringify(kept, null, 2)}\n`, "utf8");
  return { before, after: kept.length };
}

async function trimPostgres(limit: number): Promise<{ before: number; removed: number; after: number }> {
  const sql = postgres(loadDatabaseUrl(), { ssl: "require", prepare: false, max: 1 });

  const [{ count: before }] = await sql<{ count: number }[]>`
    select count(*)::int as count from crm.clients
  `;

  if (before <= limit) {
    await sql.end();
    return { before, removed: 0, after: before };
  }

  const keepRows = await sql<{ id: string }[]>`
    select id from crm.clients order by created_at asc limit ${limit}
  `;
  const keepIds = keepRows.map((row) => row.id);

  const deletedAssignments = await sql`
    delete from crm.client_assignments
    where not (client_id = any(${keepIds}))
  `;
  const deletedClients = await sql`
    delete from crm.clients
    where not (id = any(${keepIds}))
  `;

  const [{ count: after }] = await sql<{ count: number }[]>`
    select count(*)::int as count from crm.clients
  `;

  await sql.end();
  console.log("  atribuições removidas:", deletedAssignments.count);
  return { before, removed: deletedClients.count, after };
}

const pg = await trimPostgres(LIMIT);
const json = trimJsonFallback(LIMIT);

console.log(`Limite: ${LIMIT.toLocaleString("pt-BR")} clientes`);
console.log("Supabase:");
console.log("  antes:", pg.before.toLocaleString("pt-BR"));
console.log("  removidos:", pg.removed.toLocaleString("pt-BR"));
console.log("  restantes:", pg.after.toLocaleString("pt-BR"));
console.log("JSON local:");
console.log("  antes:", json.before.toLocaleString("pt-BR"));
console.log("  restantes:", json.after.toLocaleString("pt-BR"));
console.log("OK — base reduzida ao limite.");
