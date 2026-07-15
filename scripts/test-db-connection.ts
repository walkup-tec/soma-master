import { readFileSync } from "node:fs";
import postgres from "postgres";

function loadEnv(): Record<string, string> {
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
  return env;
}

function extractPasswordFromUrl(url: string): string | null {
  const match = url.match(/^postgresql:\/\/postgres(?:\.[^:@]+)?:([^@]+)@/);
  return match?.[1] ?? null;
}

const env = loadEnv();
const rawUrl = env.DATABASE_URL;
if (!rawUrl) {
  console.error("FAIL DATABASE_URL não encontrada em .env.local");
  process.exit(1);
}

const password = extractPasswordFromUrl(rawUrl);
const projectRef = "nxuxclelzngykskehala";
if (!password) {
  console.error("FAIL não foi possível ler a senha da DATABASE_URL");
  process.exit(1);
}

const regions = ["us-east-1", "us-east-2", "us-west-1", "sa-east-1"];
const pools = ["aws-0", "aws-1"];

const candidates: { label: string; url: string }[] = [
  { label: "direct:5432", url: rawUrl },
];

for (const pool of pools) {
  for (const region of regions) {
    for (const port of [6543, 5432] as const) {
      candidates.push({
        label: `${pool}-${region}:${port}`,
        url: `postgresql://postgres.${projectRef}:${password}@${pool}-${region}.pooler.supabase.com:${port}/postgres`,
      });
    }
  }
}

for (const candidate of candidates) {
  const sql = postgres(candidate.url, { max: 1, connect_timeout: 10, ssl: "require" });
  try {
    const rows = await sql`
      select (select count(*)::int from information_schema.tables where table_schema = 'crm') as crm_tables
    `;
    console.log("OK", candidate.label, rows[0]);
    console.log("USE_POOLER", candidate.label !== "direct:5432");
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("FAIL", candidate.label, message.slice(0, 80));
  } finally {
    await sql.end();
  }
}

console.error("\nNenhuma conexão funcionou.");
console.error("No Supabase: Connect → Transaction pooler → Copy e cole a URI inteira em DATABASE_URL.");
process.exitCode = 1;
