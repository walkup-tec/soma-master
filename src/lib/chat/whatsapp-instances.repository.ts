/**
 * Registro de canais WhatsApp do Chat.
 * Evolution (QR, prefixo soma-*) e Cloud API oficial (prefixo meta-{phoneNumberId}).
 */

import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  SOMA_EVOLUTION_INSTANCE_DEFAULT,
  SOMA_EVOLUTION_INSTANCE_PREFIX,
  assertSomaOwnedInstance,
} from "@/lib/chat/evolution.adapter";
import { isMetaCloudInstanceName } from "@/lib/chat/meta-cloud/meta-cloud.constants";
import { ensureChatSchema } from "@/lib/chat/ensure-chat-schema";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";

export type ChatWhatsappProvider = "evolution" | "meta_cloud";

export type ChatWhatsappInstance = {
  id: string;
  instanceName: string;
  label: string;
  phone: string | null;
  provider: ChatWhatsappProvider;
  phoneNumberId: string | null;
  wabaId: string | null;
  businessId: string | null;
  accessTokenEncrypted: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  tokenExpiresAt: string | null;
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

type InstanceRow = {
  id: string;
  instance_name: string;
  label: string;
  phone: string | null;
  provider?: string | null;
  phone_number_id?: string | null;
  waba_id?: string | null;
  business_id?: string | null;
  access_token_encrypted?: string | null;
  verified_name?: string | null;
  quality_rating?: string | null;
  token_expires_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function resolveProvider(row: { provider?: string | null; instanceName?: string; instance_name?: string }): ChatWhatsappProvider {
  if (row.provider === "meta_cloud") return "meta_cloud";
  if (row.provider === "evolution") return "evolution";
  const name = row.instanceName || row.instance_name || "";
  return isMetaCloudInstanceName(name) ? "meta_cloud" : "evolution";
}

function mapRow(row: InstanceRow): ChatWhatsappInstance {
  return {
    id: row.id,
    instanceName: row.instance_name,
    label: row.label,
    phone: row.phone,
    provider: resolveProvider(row),
    phoneNumberId: row.phone_number_id ?? null,
    wabaId: row.waba_id ?? null,
    businessId: row.business_id ?? null,
    accessTokenEncrypted: row.access_token_encrypted ?? null,
    verifiedName: row.verified_name ?? null,
    qualityRating: row.quality_rating ?? null,
    tokenExpiresAt: toIso(row.token_expires_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function withInstanceDefaults(
  item: Partial<ChatWhatsappInstance> & Pick<ChatWhatsappInstance, "id" | "instanceName" | "label" | "createdAt" | "updatedAt">,
): ChatWhatsappInstance {
  return {
    ...item,
    phone: item.phone ?? null,
    provider: item.provider ?? resolveProvider(item),
    phoneNumberId: item.phoneNumberId ?? null,
    wabaId: item.wabaId ?? null,
    businessId: item.businessId ?? null,
    accessTokenEncrypted: item.accessTokenEncrypted ?? null,
    verifiedName: item.verifiedName ?? null,
    qualityRating: item.qualityRating ?? null,
    tokenExpiresAt: item.tokenExpiresAt ?? null,
  };
}

export async function listWhatsappInstances(): Promise<ChatWhatsappInstance[]> {
  if (isDatabaseEnabled()) {
    const sql = await getSql();
    await ensureChatSchema(sql);
    const rows = await sql<InstanceRow[]>`
      select id, instance_name, label, phone, provider, phone_number_id, waba_id, business_id,
             access_token_encrypted, verified_name, quality_rating, token_expires_at,
             created_at, updated_at
      from crm.chat_whatsapp_instances
      order by created_at asc
    `;
    return rows.map(mapRow);
  }

  const items = await readJsonFile<ChatWhatsappInstance[]>(FILE, []);
  return items.map((item) => withInstanceDefaults(item));
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
    provider: "evolution",
    phoneNumberId: null,
    wabaId: null,
    businessId: null,
    accessTokenEncrypted: null,
    verifiedName: null,
    qualityRating: null,
    tokenExpiresAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    await ensureChatSchema(sql);
    await sql`
      insert into crm.chat_whatsapp_instances (
        id, instance_name, label, phone, provider, created_at, updated_at
      )
      values (
        ${row.id},
        ${row.instanceName},
        ${row.label},
        null,
        'evolution',
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

export async function getWhatsappInstanceByPhoneNumberId(
  phoneNumberId: string,
): Promise<ChatWhatsappInstance | null> {
  const id = String(phoneNumberId || "").trim();
  if (!id) return null;
  const all = await listWhatsappInstances();
  return all.find((item) => item.phoneNumberId === id) ?? null;
}

export async function upsertMetaCloudWhatsappInstance(input: {
  instanceName: string;
  label: string;
  phone: string | null;
  phoneNumberId: string;
  wabaId: string | null;
  businessId: string | null;
  accessTokenEncrypted: string;
  verifiedName: string | null;
  qualityRating: string | null;
  tokenExpiresAt: string | null;
}): Promise<ChatWhatsappInstance> {
  const instanceName = String(input.instanceName || "").trim();
  if (!isMetaCloudInstanceName(instanceName)) {
    throw new Error(`Instância Cloud inválida: ${instanceName}`);
  }
  const existing = await getWhatsappInstanceByPhoneNumberId(input.phoneNumberId);
  const now = new Date();
  const row: ChatWhatsappInstance = {
    id: existing?.id ?? `wa-${crypto.randomUUID().slice(0, 10)}`,
    instanceName: existing?.instanceName ?? instanceName,
    label: String(input.label || existing?.label || "WhatsApp oficial").trim(),
    phone: input.phone,
    provider: "meta_cloud",
    phoneNumberId: input.phoneNumberId,
    wabaId: input.wabaId,
    businessId: input.businessId,
    accessTokenEncrypted: input.accessTokenEncrypted,
    verifiedName: input.verifiedName,
    qualityRating: input.qualityRating,
    tokenExpiresAt: input.tokenExpiresAt,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    await ensureChatSchema(sql);
    await sql`
      insert into crm.chat_whatsapp_instances (
        id, instance_name, label, phone, provider, phone_number_id, waba_id, business_id,
        access_token_encrypted, verified_name, quality_rating, token_expires_at,
        created_at, updated_at
      ) values (
        ${row.id},
        ${row.instanceName},
        ${row.label},
        ${row.phone},
        'meta_cloud',
        ${row.phoneNumberId},
        ${row.wabaId},
        ${row.businessId},
        ${row.accessTokenEncrypted},
        ${row.verifiedName},
        ${row.qualityRating},
        ${row.tokenExpiresAt ? new Date(row.tokenExpiresAt) : null},
        ${new Date(row.createdAt)},
        ${now}
      )
      on conflict (instance_name) do update set
        label = excluded.label,
        phone = excluded.phone,
        provider = 'meta_cloud',
        phone_number_id = excluded.phone_number_id,
        waba_id = excluded.waba_id,
        business_id = excluded.business_id,
        access_token_encrypted = excluded.access_token_encrypted,
        verified_name = excluded.verified_name,
        quality_rating = excluded.quality_rating,
        token_expires_at = excluded.token_expires_at,
        updated_at = excluded.updated_at
    `;
    return row;
  }

  const items = await readJsonFile<ChatWhatsappInstance[]>(FILE, []);
  const next = items.filter(
    (item) => item.instanceName !== row.instanceName && item.phoneNumberId !== row.phoneNumberId,
  );
  next.push(row);
  await writeJsonFile(FILE, next);
  return row;
}

export async function upsertEvolutionChannel(input: {
  instanceName: string;
  label: string;
  phone: string | null;
}): Promise<ChatWhatsappInstance> {
  const instanceName = String(input.instanceName || "").trim();
  if (!instanceName) throw new Error("Instância Evolution obrigatória.");
  const existing = await getWhatsappInstanceByName(instanceName);
  const now = new Date();
  const row: ChatWhatsappInstance = {
    id: existing?.id ?? `wa-${crypto.randomUUID().slice(0, 10)}`,
    instanceName,
    label: String(input.label || existing?.label || instanceName).trim(),
    phone: input.phone ?? existing?.phone ?? null,
    provider: "evolution",
    phoneNumberId: existing?.phoneNumberId ?? null,
    wabaId: existing?.wabaId ?? null,
    businessId: existing?.businessId ?? null,
    accessTokenEncrypted: existing?.accessTokenEncrypted ?? null,
    verifiedName: existing?.verifiedName ?? null,
    qualityRating: existing?.qualityRating ?? null,
    tokenExpiresAt: existing?.tokenExpiresAt ?? null,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    await ensureChatSchema(sql);
    await sql`
      insert into crm.chat_whatsapp_instances (
        id, instance_name, label, phone, provider, created_at, updated_at
      ) values (
        ${row.id},
        ${row.instanceName},
        ${row.label},
        ${row.phone},
        'evolution',
        ${row.createdAt === existing?.createdAt ? new Date(row.createdAt) : now},
        ${now}
      )
      on conflict (instance_name) do update set
        label = excluded.label,
        phone = coalesce(excluded.phone, crm.chat_whatsapp_instances.phone),
        updated_at = excluded.updated_at
    `;
    return row;
  }

  const items = await readJsonFile<ChatWhatsappInstance[]>(FILE, []);
  const next = items.filter((item) => item.instanceName !== instanceName);
  next.push(row);
  await writeJsonFile(FILE, next);
  return row;
}

export async function deleteWhatsappInstance(instanceName: string): Promise<void> {
  const name = String(instanceName || "").trim();
  if (!name) return;

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
