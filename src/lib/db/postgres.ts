import postgres from "postgres";
import { loadLocalEnvFile } from "@/lib/db/load-env-file";
import { ensureClientListIndexes } from "@/lib/db/ensure-client-indexes";
import { ensurePartnerSchema } from "@/lib/db/ensure-partner-schema";
import { ensureDatabaseSeeded } from "@/lib/db/seed";

loadLocalEnvFile();

export type Sql = postgres.Sql;

let sqlInstance: Sql | null = null;
let ready: Promise<void> | null = null;

export function isDatabaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function getSql(): Promise<Sql> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL não configurada. Defina em .env.local.");
  }

  if (!sqlInstance) {
    // Via 172.17.0.1/socat ou IP: cert do Supabase não casa o hostname → SSL_INSECURE.
    const insecure =
      process.env.DATABASE_SSL_INSECURE === "1" || process.env.DATABASE_SSL_INSECURE === "true";
    sqlInstance = postgres(url, {
      ssl: insecure ? { rejectUnauthorized: false } : "require",
      prepare: false,
      max: 10,
      connect_timeout: 15,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
    });
  }

  if (!ready) {
    ready = ensureDatabaseSeeded(sqlInstance)
      .then(() => ensureClientListIndexes(sqlInstance!))
      .then(() => ensurePartnerSchema(sqlInstance!))
      .catch((error) => {
        ready = null;
        throw error;
      });
  }
  await ready;

  return sqlInstance;
}

/** Aquece pool + seed/indexes em background (não bloqueia o boot). */
export function warmDatabaseConnection(): void {
  if (!isDatabaseEnabled()) return;
  void getSql().catch((error) => {
    console.error("[db] warm connection failed", error);
  });
}
