import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureBotHasStart, normalizeBotDraft } from "@/lib/bots/bot-flow.normalize";
import type { BotFlowDraft } from "@/lib/bots/bot.types";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";

const DATA_DIR = join(process.cwd(), "data");
const FLOWS_FILE = join(DATA_DIR, "bot-flows.json");

let schemaEnsured = false;

async function ensureBotFlowsSchema(): Promise<void> {
  if (!isDatabaseEnabled() || schemaEnsured) return;
  const sql = await getSql();
  await sql`create schema if not exists crm`;
  await sql`
    create table if not exists crm.bot_flows (
      id text primary key,
      name text not null,
      draft jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  schemaEnsured = true;
}

async function readFlowsFromDisk(): Promise<BotFlowDraft[]> {
  try {
    const raw = await readFile(FLOWS_FILE, "utf8");
    const parsed = JSON.parse(raw) as BotFlowDraft[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ensureBotHasStart(normalizeBotDraft(item)));
  } catch {
    return [];
  }
}

async function writeFlowsToDisk(flows: BotFlowDraft[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FLOWS_FILE, JSON.stringify(flows, null, 2), "utf8");
}

function normalizeFlow(raw: unknown): BotFlowDraft | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    return ensureBotHasStart(normalizeBotDraft(raw as BotFlowDraft));
  } catch {
    return null;
  }
}

export async function listBotFlowsFromServer(): Promise<BotFlowDraft[]> {
  if (isDatabaseEnabled()) {
    await ensureBotFlowsSchema();
    const sql = await getSql();
    const rows = await sql<{ draft: unknown }[]>`
      select draft from crm.bot_flows order by updated_at desc
    `;
    return rows
      .map((row) => normalizeFlow(row.draft))
      .filter((item): item is BotFlowDraft => Boolean(item));
  }
  return readFlowsFromDisk();
}

export async function getBotFlowFromServer(id: string): Promise<BotFlowDraft | null> {
  const flowId = String(id || "").trim();
  if (!flowId) return null;
  if (isDatabaseEnabled()) {
    await ensureBotFlowsSchema();
    const sql = await getSql();
    const rows = await sql<{ draft: unknown }[]>`
      select draft from crm.bot_flows where id = ${flowId} limit 1
    `;
    return normalizeFlow(rows[0]?.draft) ?? null;
  }
  const all = await readFlowsFromDisk();
  return all.find((item) => item.id === flowId) ?? null;
}

export async function upsertBotFlowOnServer(draft: BotFlowDraft): Promise<BotFlowDraft> {
  const next = ensureBotHasStart(
    normalizeBotDraft({
      ...draft,
      updatedAt: new Date().toISOString(),
    }),
  );
  if (isDatabaseEnabled()) {
    await ensureBotFlowsSchema();
    const sql = await getSql();
    await sql`
      insert into crm.bot_flows (id, name, draft, updated_at)
      values (${next.id}, ${next.name}, ${sql.json(next)}, ${new Date(next.updatedAt)})
      on conflict (id) do update set
        name = excluded.name,
        draft = excluded.draft,
        updated_at = excluded.updated_at
    `;
    return next;
  }
  const all = await readFlowsFromDisk();
  const others = all.filter((item) => item.id !== next.id);
  await writeFlowsToDisk([next, ...others]);
  return next;
}

export async function deleteBotFlowOnServer(id: string): Promise<boolean> {
  const flowId = String(id || "").trim();
  if (!flowId) return false;
  if (isDatabaseEnabled()) {
    await ensureBotFlowsSchema();
    const sql = await getSql();
    const rows = await sql<{ id: string }[]>`
      delete from crm.bot_flows where id = ${flowId} returning id
    `;
    return rows.length > 0;
  }
  const all = await readFlowsFromDisk();
  const next = all.filter((item) => item.id !== flowId);
  if (next.length === all.length) return false;
  await writeFlowsToDisk(next);
  return true;
}
