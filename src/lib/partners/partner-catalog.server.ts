import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig, type SessionData } from "@/lib/auth/session-config";
import type { MenuItemId } from "@/lib/config/menu-items";
import {
  createPartnerOnlyProduct,
  deletePartnerCommissionTable,
  listPartnerCommissionTables,
  listPartnerProductBankRows,
  listPartnerVisibleBanks,
  setPartnerVisibleBanks,
  upsertPartnerCommissionTable,
} from "@/lib/partners/partner-catalog.repository";
import type { PartnerCommissionTableInput } from "@/lib/partners/partner-catalog.types";
import { listPartners } from "@/lib/partners/partner.service";

async function requireCatalogActor(menuId: MenuItemId) {
  const session = await getSession<SessionData>(sessionConfig);
  const user = session.data;
  if (!user?.userId || !user.name || !user.role || !user.menuIds) {
    throw new Error("Não autenticado.");
  }
  const authenticatedUser = user as SessionData;
  if (
    authenticatedUser.role !== "master" &&
    !sessionCanAccessMenu(authenticatedUser, menuId) &&
    !sessionCanAccessMenu(authenticatedUser, "parceiros")
  ) {
    throw new Error("Você não possui acesso a este módulo de Parceiros.");
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

export const listPartnerVisibleBanksFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireCatalogActor("parceiros-bancos");
  return listPartnerVisibleBanks();
});

export const savePartnerVisibleBanksFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const value = objectData(data);
    return { bankIds: stringArray(value.bankIds) };
  })
  .handler(async ({ data }) => {
    await requireCatalogActor("parceiros-bancos");
    return setPartnerVisibleBanks(data.bankIds);
  });

export const listPartnerProductBankRowsFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireCatalogActor("parceiros-produtos");
  return listPartnerProductBankRows();
});

export const createPartnerOnlyProductFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const value = objectData(data);
    return {
      name: stringValue(value.name),
      color: stringValue(value.color) || "#be1c6a",
      bankIds: stringArray(value.bankIds),
    };
  })
  .handler(async ({ data }) => {
    await requireCatalogActor("parceiros-produtos");
    return createPartnerOnlyProduct(data);
  });

export const listPartnerCommissionTablesFn = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireCatalogActor("parceiros-tabelas");
  return listPartnerCommissionTables({
    isMaster: actor.isMaster,
    createdByUserId: actor.userId,
  });
});

export const listPartnersForTablesFn = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requireCatalogActor("parceiros-tabelas");
  const page = await listPartners(
    {
      userId: actor.userId,
      name: actor.name,
      isMaster: actor.isMaster,
      menuIds: actor.menuIds,
    },
    { status: "active", search: "", production: "all", bankIds: [], page: 1, pageSize: 200 },
  );
  return page.items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
  }));
});

export const upsertPartnerCommissionTableFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const value = objectData(data);
    const input: PartnerCommissionTableInput = {
      id: stringValue(value.id) || undefined,
      name: stringValue(value.name),
      productId: stringValue(value.productId),
      bankId: stringValue(value.bankId),
      isDefault: value.isDefault === true,
      partnerCategory: stringValue(value.partnerCategory) || null,
      partnerUserIds: stringArray(value.partnerUserIds),
      fixedValueEnabled: value.fixedValueEnabled === true,
      fixedValueCents:
        value.fixedValueCents == null || value.fixedValueCents === ""
          ? null
          : Math.round(Number(value.fixedValueCents)),
      fixedValueMaxCents:
        value.fixedValueMaxCents == null || value.fixedValueMaxCents === ""
          ? null
          : Math.round(Number(value.fixedValueMaxCents)),
      flatPercent: Number(value.flatPercent || 0),
      repassePercent: Number(value.repassePercent || 0),
      rangeMinCents: Math.round(Number(value.rangeMinCents || 0)),
      rangeMaxCents: Math.round(Number(value.rangeMaxCents || 0)),
    };
    return input;
  })
  .handler(async ({ data }) => {
    const actor = await requireCatalogActor("parceiros-tabelas");
    return upsertPartnerCommissionTable(data, actor);
  });

export const deletePartnerCommissionTableFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const value = objectData(data);
    return { tableId: stringValue(value.tableId) };
  })
  .handler(async ({ data }) => {
    const actor = await requireCatalogActor("parceiros-tabelas");
    return deletePartnerCommissionTable(data.tableId, actor);
  });

export const listPartnerProductBankRowsForTablesFn = createServerFn({ method: "GET" }).handler(
  async () => {
    await requireCatalogActor("parceiros-tabelas");
    return listPartnerProductBankRows();
  },
);
