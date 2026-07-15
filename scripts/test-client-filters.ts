import postgres from "postgres";
import { loadLocalEnvFile } from "../src/lib/db/load-env-file";

loadLocalEnvFile();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", prepare: false });

async function countFiltered(attendance: "with" | "without" | "all") {
  const whereClause = sql`
    where true
    ${
      attendance === "with"
        ? sql`and exists (select 1 from crm.client_attendances att where att.client_id = c.id)`
        : attendance === "without"
          ? sql`and not exists (select 1 from crm.client_attendances att where att.client_id = c.id)`
          : sql``
    }
  `;
  const [{ total }] = await sql<{ total: number }[]>`
    select count(*)::int as total from crm.clients c ${whereClause}
  `;
  return total;
}

const all = await countFiltered("all");
const without = await countFiltered("without");
const withAtt = await countFiltered("with");

console.log({ all, without, withAtt });
await sql.end();
