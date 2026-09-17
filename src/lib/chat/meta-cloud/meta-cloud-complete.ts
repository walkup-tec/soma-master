import { callMetaGraphJson } from "@/lib/chat/meta-cloud/meta-graph.client";
import { isMetaCloudConfigured } from "@/lib/chat/meta-cloud/meta-config";
import { metaCloudInstanceName } from "@/lib/chat/meta-cloud/meta-cloud.constants";
import { exchangeEmbeddedSignupCode } from "@/lib/chat/meta-cloud/meta-oauth";
import { encryptMetaToken } from "@/lib/chat/meta-cloud/meta-token-crypto";
import { registerSomaCloudNumberOnWaba } from "@/lib/chat/meta-cloud/waba-cloud-relay.client";
import { upsertMetaCloudWhatsappInstance } from "@/lib/chat/whatsapp-instances.repository";

export type MetaEmbeddedSignupCompleteInput = {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
  verifiedName?: string;
  label?: string;
};

export type MetaEmbeddedSignupCompleteResult = {
  ok: true;
  instanceName: string;
  phone: string | null;
  verifiedName: string | null;
  phoneNumberId: string;
  wabaId: string | null;
  wabaRelayOk: boolean;
  wabaRelayError?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return String(value || "").trim();
}

type GraphPhone = {
  id: string;
  displayPhone: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
};

function parsePhoneJson(json: unknown): GraphPhone | null {
  const row = asRecord(json);
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    displayPhone: text(row.display_phone_number).replace(/\D+/g, "") || null,
    verifiedName: text(row.verified_name) || null,
    qualityRating: text(row.quality_rating) || null,
  };
}

async function listWabaPhones(token: string, wabaId: string): Promise<GraphPhone[]> {
  const result = await callMetaGraphJson({
    token,
    method: "GET",
    path: `${wabaId}/phone_numbers`,
    query: { fields: "id,display_phone_number,verified_name,quality_rating" },
  });
  if (!result.ok) return [];
  const data = asRecord(result.json).data;
  if (!Array.isArray(data)) return [];
  return data.map(parsePhoneJson).filter((item): item is GraphPhone => Boolean(item));
}

async function fetchPhone(token: string, phoneNumberId: string): Promise<GraphPhone | null> {
  const result = await callMetaGraphJson({
    token,
    method: "GET",
    path: phoneNumberId,
    query: { fields: "id,display_phone_number,verified_name,quality_rating" },
  });
  if (!result.ok) return null;
  return parsePhoneJson(result.json);
}

async function ensureSubscribedApps(token: string, wabaId: string): Promise<void> {
  const existing = await callMetaGraphJson({
    token,
    method: "GET",
    path: `${wabaId}/subscribed_apps`,
  });
  if (existing.ok) {
    const data = asRecord(existing.json).data;
    if (Array.isArray(data) && data.length > 0) return;
  }
  await callMetaGraphJson({
    token,
    method: "POST",
    path: `${wabaId}/subscribed_apps`,
  });
}

export async function completeMetaEmbeddedSignup(
  input: MetaEmbeddedSignupCompleteInput,
): Promise<MetaEmbeddedSignupCompleteResult> {
  if (!isMetaCloudConfigured()) {
    throw new Error("Embedded Signup indisponível: configure META_APP_ID, META_APP_SECRET e META_CONFIG_ID.");
  }
  const code = String(input.code || "").trim();
  if (!code) throw new Error("Código da Meta ausente.");

  const exchanged = await exchangeEmbeddedSignupCode({ code });
  const encrypted = encryptMetaToken(exchanged.accessToken);

  let wabaId = String(input.wabaId || "").trim();
  let phoneNumberId = String(input.phoneNumberId || "").trim();
  let phone: GraphPhone | null = null;

  if (phoneNumberId) {
    phone = await fetchPhone(exchanged.accessToken, phoneNumberId);
  }
  if (!wabaId && phoneNumberId) {
    const phoneWaba = await callMetaGraphJson({
      token: exchanged.accessToken,
      method: "GET",
      path: phoneNumberId,
      query: { fields: "whatsapp_business_account" },
    });
    wabaId = text(asRecord(asRecord(phoneWaba.json).whatsapp_business_account).id);
  }
  if (!phone && wabaId) {
    const phones = await listWabaPhones(exchanged.accessToken, wabaId);
    phone = phones.find((item) => item.id === phoneNumberId) ?? phones[phones.length - 1] ?? null;
  }
  if (phone) {
    phoneNumberId = phone.id;
  }
  if (!phoneNumberId) {
    throw new Error(
      "A Meta não devolveu o phone_number_id. Conclua o Embedded Signup até selecionar o número e tente de novo.",
    );
  }
  if (!phone) {
    phone = await fetchPhone(exchanged.accessToken, phoneNumberId);
  }
  if (wabaId) {
    await ensureSubscribedApps(exchanged.accessToken, wabaId);
  }

  const label =
    String(input.label || "").trim() ||
    phone?.verifiedName ||
    input.verifiedName ||
    "WhatsApp oficial";

  const saved = await upsertMetaCloudWhatsappInstance({
    instanceName: metaCloudInstanceName(phoneNumberId),
    label,
    phone: phone?.displayPhone ?? null,
    phoneNumberId,
    wabaId: wabaId || null,
    businessId: String(input.businessId || "").trim() || null,
    accessTokenEncrypted: encrypted,
    verifiedName: phone?.verifiedName || String(input.verifiedName || "").trim() || null,
    qualityRating: phone?.qualityRating ?? null,
    tokenExpiresAt: exchanged.expiresIn
      ? new Date(Date.now() + exchanged.expiresIn * 1000).toISOString()
      : null,
  });

  const relay = await registerSomaCloudNumberOnWaba({
    phoneNumberId,
    wabaId: wabaId || null,
    displayPhone: saved.phone,
    label: saved.label,
  });

  return {
    ok: true,
    instanceName: saved.instanceName,
    phone: saved.phone,
    verifiedName: saved.verifiedName,
    phoneNumberId,
    wabaId: wabaId || null,
    wabaRelayOk: relay.ok,
    wabaRelayError: relay.error,
  };
}
