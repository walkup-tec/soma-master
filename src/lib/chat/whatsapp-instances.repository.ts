/**
 * Registro de canais WhatsApp (instâncias Evolution soma-*) do Chat.
 * A API Evolution (URL/KEY) continua no .env; as instâncias são dinâmicas.
 */

import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  SOMA_EVOLUTION_INSTANCE_DEFAULT,
  SOMA_EVOLUTION_INSTANCE_PREFIX,
  assertSomaOwnedInstance,
} from "@/lib/chat/evolution.adapter";
import { ensureChatSchema } from "@/lib/chat/ensure-chat-schema";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";

export type ChatWhatsappInstance = {
  id: string;
  instanceName: string;
  label: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "chat-whatsapp-instances.json");

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

function defaultInstanceName(): string {
  const fromEnv = process.env.EVOLUTION_INSTANCE?.trim() || SOMA_EVOLUTION_INSTANCE_DEFAULT;
  assertSomaOwnedInstance(fromEnv);
  return fromEnv;
}

function mapRow(row: {
  id: string;
  instance_name: string;
  label: string;
  phone: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}): ChatWhatsappInstance {
  return {
    id: row.id,
    instanceName: row.instance_name,
    label: row.label,
    phone: row.phone,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

/** Garante ao menos a instância padrão (env) no registro. */
export async function ensureDefaultWhatsappInstance(): Promise<ChatWhatsappInstance> {
  const instanceName = defaultInstanceName();
  const existing = await listWhatsappInstances();
  const found = existing.find((item) => item.instanceName === instanceName);
  if (found) return found;
  return createWhatsappInstance({
    label: "Principal",
    instanceName,
  });
}

export async function listWhatsappInstances(): Promise<ChatWhatsappInstance[]> {
  if (isDatabaseEnabled()) {
    const sql = await getSql();
    await ensureChatSchema(sql);
    const rows = await sql<
      {
        id: string;
        instance_name: string;
        label: string;
        phone: string | null;
        created_at: Date;
        updated_at: Date;
      }[]
    >`
      select id, instance_name, label, phone, created_at, updated_at
      from crm.chat_whatsapp_instances
      order by created_at asc
    `;
    return rows.map(mapRow);
  }

  return readJsonFile<ChatWhatsappInstance[]>(FILE, []);
}

export async function getWhatsappInstanceByName(
  instanceName: string,
): Promise<ChatWhatsappInstance | null> {
  const name = String(instanceName || "").trim();
  if (!name) return null;
  const all = await listWhatsappInstances();
  return all.find((item) => item.instanceName === name) ?? null;
}

export function slugifyInstanceLabel(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const slug = base || `canal-${crypto.randomUUID().slice(0, 6)}`;
  return `${SOMA_EVOLUTION_INSTANCE_PREFIX}${slug}`;
}

export async function createWhatsappInstance(input: {
  label: string;
  instanceName?: string;
}): Promise<ChatWhatsappInstance> {
  const label = String(input.label || "").trim() || "Canal WhatsApp";
  let instanceName = String(input.instanceName || "").trim();
  if (!instanceName) {
    instanceName = slugifyInstanceLabel(label);
  }
  assertSomaOwnedInstance(instanceName);

  const existing = await listWhatsappInstances();
  if (existing.some((item) => item.instanceName === instanceName)) {
    if (!input.instanceName) {
      instanceName = `${instanceName}-${crypto.randomUUID().slice(0, 4)}`;
      assertSomaOwnedInstance(instanceName);
    } else {
      throw new Error(`Já existe um canal com a instância "${instanceName}".`);
    }
  }

  const now = new Date();
  const row: ChatWhatsappInstance = {
    id: `wa-${crypto.randomUUID().slice(0, 10)}`,
    instanceName,
    label,
    phone: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    await ensureChatSchema(sql);
    await sql`
      insert into crm.chat_whatsapp_instances (id, instance_name, label, phone, created_at, updated_at)
      values (
        ${row.id},
        ${row.instanceName},
        ${row.label},
        null,
        ${now},
        ${now}
      )
    `;
    return row;
  }

  const items = await readJsonFile<ChatWhatsappInstance[]>(FILE, []);
  items.push(row);
  await writeJsonFile(FILE, items);
  return row;
}

export async function updateWhatsappInstancePhone(
  instanceName: string,
  phone: string | null,
): Promise<void> {
  const name = String(instanceName || "").trim();
  if (!name) return;
  const normalized = phone ? phone.replace(/\D+/g, "") || null : null;

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    await ensureChatSchema(sql);
    await sql`
      update crm.chat_whatsapp_instances
      set phone = ${normalized}, updated_at = now()
      where instance_name = ${name}
    `;
    return;
  }

  const items = await readJsonFile<ChatWhatsappInstance[]>(FILE, []);
  await writeJsonFile(
    FILE,
    items.map((item) =>
      item.instanceName === name
        ? { ...item, phone: normalized, updatedAt: new Date().toISOString() }
        : item,
    ),
  );
}

export async function deleteWhatsappInstance(instanceName: string): Promise<void> {
  const name = String(instanceName || "").trim();
  assertSomaOwnedInstance(name);

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    await ensureChatSchema(sql);
    await sql`delete from crm.chat_whatsapp_instances where instance_name = ${name}`;
    return;
  }

  const items = await readJsonFile<ChatWhatsappInstance[]>(FILE, []);
  await writeJsonFile(
    FILE,
    items.filter((item) => item.instanceName !== name),
  );
}
