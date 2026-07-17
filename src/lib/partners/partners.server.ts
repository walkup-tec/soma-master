import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { invalidateAuthEnrichCache } from "@/lib/auth/auth.server";
import { sessionConfig, type SessionData } from "@/lib/auth/session-config";
import type { MenuItemId } from "@/lib/config/menu-items";
import {
  createPartner,
  editPartner,
  getPartnerEvents,
  listPartners,
  setPartnerStatus,
  type PartnerActor,
} from "@/lib/partners/partner.service";
import type {
  PartnerCategory,
  PartnerListQuery,
  PartnerPersonType,
  PartnerPixKeyType,
  PartnerProductionFilter,
  PartnerStatus,
  PartnerUpsertInput,
} from "@/lib/partners/partner.types";
import { lookupViaCep } from "@/lib/partners/viacep.adapter";

async function requirePartnerActor(): Promise<PartnerActor> {
  const session = await getSession<SessionData>(sessionConfig);
  const user = session.data;
  if (!user?.userId || !user.name || !user.role || !user.menuIds) {
    throw new Error("Não autenticado.");
  }
  const authenticatedUser = user as SessionData;
  if (
    authenticatedUser.role !== "master" &&
    !sessionCanAccessMenu(authenticatedUser, "parceiros")
  ) {
    throw new Error("Você não possui acesso à área Parceiros.");
  }
  return {
    userId: authenticatedUser.userId,
    name: authenticatedUser.name,
    isMaster: authenticatedUser.role === "master",
    menuIds: authenticatedUser.menuIds,
  };
}

function objectData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
  return data as Record<string, unknown>;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function partnerListSchema(data: unknown): PartnerListQuery {
  const value = objectData(data);
  const rawStatus = stringValue(value.status);
  const status: PartnerStatus = ["active", "inactive", "blocked"].includes(rawStatus)
    ? (rawStatus as PartnerStatus)
    : "active";
  const rawProduction = stringValue(value.production);
  const production: PartnerProductionFilter = ["all", "with", "without"].includes(rawProduction)
    ? (rawProduction as PartnerProductionFilter)
    : "all";
  const page = Math.max(1, Math.floor(Number(value.page) || 1));
  const pageSize = Math.min(100, Math.max(10, Math.floor(Number(value.pageSize) || 20)));
  return {
    status,
    search: stringValue(value.search).trim().slice(0, 160),
    production,
    bankIds: stringArray(value.bankIds).slice(0, 20),
    page,
    pageSize,
  };
}

function partnerUpsertSchema(data: unknown): PartnerUpsertInput & { partnerId?: string } {
  const value = objectData(data);
  return {
    partnerId: stringValue(value.partnerId).trim() || undefined,
    category: stringValue(value.category) as PartnerCategory,
    personType: stringValue(value.personType) as PartnerPersonType,
    name: stringValue(value.name),
    taxId: stringValue(value.taxId),
    rg: stringValue(value.rg),
    email: stringValue(value.email),
    password: stringValue(value.password) || undefined,
    phone: stringValue(value.phone),
    whatsapp: stringValue(value.whatsapp),
    pixKeyType: stringValue(value.pixKeyType) as PartnerPixKeyType,
    pixKey: stringValue(value.pixKey),
    cep: stringValue(value.cep),
    street: stringValue(value.street),
    neighborhood: stringValue(value.neighborhood),
    city: stringValue(value.city),
    state: stringValue(value.state),
    complement: stringValue(value.complement),
    number: stringValue(value.number),
    menuIds: stringArray(value.menuIds) as MenuItemId[],
    canCreatePartners: booleanValue(value.canCreatePartners),
    bankIds: stringArray(value.bankIds),
  };
}

function statusSchema(data: unknown): {
  partnerId: string;
  status: PartnerStatus;
  reason?: string;
} {
  const value = objectData(data);
  const partnerId = stringValue(value.partnerId).trim();
  const status = stringValue(value.status) as PartnerStatus;
  if (!partnerId) throw new Error("Parceiro inválido.");
  return {
    partnerId,
    status,
    reason: stringValue(value.reason).trim() || undefined,
  };
}

function partnerIdSchema(data: unknown): { partnerId: string } {
  const value = objectData(data);
  const partnerId = stringValue(value.partnerId).trim();
  if (!partnerId) throw new Error("Parceiro inválido.");
  return { partnerId };
}

function cepSchema(data: unknown): { cep: string } {
  const value = objectData(data);
  return { cep: stringValue(value.cep) };
}

export const listPartnersFn = createServerFn({ method: "POST" })
  .inputValidator(partnerListSchema)
  .handler(async ({ data }) => listPartners(await requirePartnerActor(), data));

export const createPartnerFn = createServerFn({ method: "POST" })
  .inputValidator(partnerUpsertSchema)
  .handler(async ({ data }) => {
    const created = await createPartner(await requirePartnerActor(), data);
    invalidateAuthEnrichCache();
    return created;
  });

export const updatePartnerFn = createServerFn({ method: "POST" })
  .inputValidator(partnerUpsertSchema)
  .handler(async ({ data }) => {
    if (!data.partnerId) throw new Error("Parceiro inválido.");
    const updated = await editPartner(await requirePartnerActor(), data.partnerId, data);
    invalidateAuthEnrichCache();
    return updated;
  });

export const changePartnerStatusFn = createServerFn({ method: "POST" })
  .inputValidator(statusSchema)
  .handler(async ({ data }) => {
    await setPartnerStatus(await requirePartnerActor(), data.partnerId, data.status, data.reason);
    invalidateAuthEnrichCache();
    return { ok: true as const };
  });

export const listPartnerEventsFn = createServerFn({ method: "POST" })
  .inputValidator(partnerIdSchema)
  .handler(async ({ data }) => getPartnerEvents(await requirePartnerActor(), data.partnerId));

export const lookupPartnerCepFn = createServerFn({ method: "POST" })
  .inputValidator(cepSchema)
  .handler(async ({ data }) => {
    await requirePartnerActor();
    return lookupViaCep(data.cep);
  });
