import { randomUUID } from "node:crypto";
import type { Sql } from "@/lib/db/postgres";
import { getSql } from "@/lib/db/postgres";
import {
  clearSystemSettingsCache,
  loadSystemSettingsFromDisk,
} from "@/lib/config/settings.repository";
import type { PartnerCategory } from "@/lib/partners/partner.types";
import type {
  PartnerCommissionTable,
  PartnerCommissionTableInput,
  PartnerProductBankRow,
  PartnerVisibleBankRow,
} from "@/lib/partners/partner-catalog.types";

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function listPartnerVisibleBanks(): Promise<PartnerVisibleBankRow[]> {
  const settings = await loadSystemSettingsFromDisk();
  const sql = await getSql();
  const rows = await sql<{ bank_id: string }[]>`
    select bank_id from crm.partner_visible_banks
  `;
  const visible = new Set(rows.map((r) => r.bank_id));
  return (settings.banks ?? []).map((bank) => ({
    id: bank.id,
    name: bank.name,
    visible: visible.has(bank.id),
  }));
}

export async function setPartnerVisibleBanks(bankIds: string[]): Promise<PartnerVisibleBankRow[]> {
  const settings = await loadSystemSettingsFromDisk();
  const allowed = new Set((settings.banks ?? []).map((b) => b.id));
  const unique = [...new Set(bankIds.map((id) => String(id || "").trim()).filter((id) => allowed.has(id)))];
  const sql = await getSql();
  await sql.begin(async (tx) => {
    await tx`delete from crm.partner_visible_banks`;
    for (const bankId of unique) {
      await tx`
        insert into crm.partner_visible_banks (bank_id, updated_at)
        values (${bankId}, now())
        on conflict (bank_id) do update set updated_at = now()
      `;
    }
  });
  return listPartnerVisibleBanks();
}

async function loadCommissionTablesRaw(sql: Sql): Promise<
  Array<{
    id: string;
    name: string;
    product_id: string;
    bank_id: string;
    is_default: boolean;
    partner_category: string | null;
    fixed_value_enabled: boolean;
    fixed_value_cents: number | null;
    flat_percent: string | number;
    repasse_percent: string | number;
    flat_cents: number | null;
    repasse_cents: number | null;
    range_min_cents: number;
    range_max_cents: number;
    created_by_user_id: string;
    created_at: Date | string;
    updated_at: Date | string;
  }>
> {
  return sql`
    select
      id, name, product_id, bank_id, is_default, partner_category,
      fixed_value_enabled, fixed_value_cents, flat_percent, repasse_percent,
      flat_cents, repasse_cents, range_min_cents, range_max_cents,
      created_by_user_id, created_at, updated_at
    from crm.partner_commission_tables
    order by updated_at desc
  `;
}

async function loadTablePartnerIds(
  sql: Sql,
  tableIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!tableIds.length) return map;
  const rows = await sql<{ table_id: string; partner_user_id: string }[]>`
    select table_id, partner_user_id
    from crm.partner_commission_table_partners
    where table_id in ${sql(tableIds)}
  `;
  for (const row of rows) {
    const list = map.get(row.table_id) ?? [];
    list.push(row.partner_user_id);
    map.set(row.table_id, list);
  }
  return map;
}

function mapTable(
  row: Awaited<ReturnType<typeof loadCommissionTablesRaw>>[number],
  partnerIds: string[],
  productName: string,
  bankName: string,
): PartnerCommissionTable {
  return {
    id: row.id,
    name: row.name,
    productId: row.product_id,
    bankId: row.bank_id,
    productName,
    bankName,
    isDefault: Boolean(row.is_default),
    partnerCategory: row.partner_category,
    partnerUserIds: partnerIds,
    fixedValueEnabled: Boolean(row.fixed_value_enabled),
    fixedValueCents: row.fixed_value_cents == null ? null : asNumber(row.fixed_value_cents),
    flatPercent: asNumber(row.flat_percent),
    repassePercent: asNumber(row.repasse_percent),
    flatCents: row.flat_cents == null ? null : asNumber(row.flat_cents),
    repasseCents: row.repasse_cents == null ? null : asNumber(row.repasse_cents),
    rangeMinCents: asNumber(row.range_min_cents),
    rangeMaxCents: asNumber(row.range_max_cents),
    createdByUserId: row.created_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listPartnerCommissionTables(options?: {
  productId?: string;
  bankId?: string;
  createdByUserId?: string;
  isMaster?: boolean;
}): Promise<PartnerCommissionTable[]> {
  const settings = await loadSystemSettingsFromDisk();
  const productNameById = new Map(settings.products.map((p) => [p.id, p.name]));
  const bankNameById = new Map((settings.banks ?? []).map((b) => [b.id, b.name]));
  const sql = await getSql();
  let rows = await loadCommissionTablesRaw(sql);
  if (options?.productId) rows = rows.filter((r) => r.product_id === options.productId);
  if (options?.bankId) rows = rows.filter((r) => r.bank_id === options.bankId);
  if (!options?.isMaster && options?.createdByUserId) {
    rows = rows.filter((r) => r.created_by_user_id === options.createdByUserId);
  }
  const partnerMap = await loadTablePartnerIds(
    sql,
    rows.map((r) => r.id),
  );
  return rows.map((row) =>
    mapTable(
      row,
      partnerMap.get(row.id) ?? [],
      productNameById.get(row.product_id) ?? row.product_id,
      bankNameById.get(row.bank_id) ?? row.bank_id,
    ),
  );
}

export async function listPartnerProductBankRows(): Promise<PartnerProductBankRow[]> {
  const settings = await loadSystemSettingsFromDisk();
  const banks = settings.banks ?? [];
  const bankNameById = new Map(banks.map((b) => [b.id, b.name]));
  const tables = await listPartnerCommissionTables({ isMaster: true });
  const tableNamesByKey = new Map<string, string[]>();
  for (const table of tables) {
    const key = `${table.productId}::${table.bankId}`;
    const list = tableNamesByKey.get(key) ?? [];
    list.push(table.name);
    tableNamesByKey.set(key, list);
  }

  const products = settings.products.filter(
    (p) => p.availableForPartners || p.partnerOnly,
  );
  const rows: PartnerProductBankRow[] = [];
  for (const product of products) {
    const bankIds = [...new Set(product.bankIds ?? [])];
    if (!bankIds.length) {
      rows.push({
        key: `${product.id}::none`,
        productId: product.id,
        productName: product.name || product.tag || "Sem nome",
        bankId: "",
        bankName: "—",
        partnerOnly: Boolean(product.partnerOnly),
        tableNames: [],
      });
      continue;
    }
    for (const bankId of bankIds) {
      const key = `${product.id}::${bankId}`;
      rows.push({
        key,
        productId: product.id,
        productName: product.name || product.tag || "Sem nome",
        bankId,
        bankName: bankNameById.get(bankId) ?? "Banco removido",
        partnerOnly: Boolean(product.partnerOnly),
        tableNames: tableNamesByKey.get(key) ?? [],
      });
    }
  }
  return rows;
}

export async function createPartnerOnlyProduct(input: {
  name: string;
  color: string;
  bankIds: string[];
}): Promise<PartnerProductBankRow[]> {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Informe o nome do produto.");
  const bankIds = [...new Set((input.bankIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!bankIds.length) throw new Error("Selecione ao menos um banco.");

  const settings = await loadSystemSettingsFromDisk();
  const allowedBanks = new Set((settings.banks ?? []).map((b) => b.id));
  for (const id of bankIds) {
    if (!allowedBanks.has(id)) throw new Error(`Banco inválido: ${id}`);
  }

  const id = `prod-${randomUUID().slice(0, 8)}`;
  const color = String(input.color || "#64748b").trim() || "#64748b";
  const sql = await getSql();
  await sql.begin(async (tx) => {
    await tx`
      insert into crm.products (id, name, tag, color, available_for_partners, partner_only, updated_at)
      values (${id}, ${name}, ${name}, ${color}, true, true, now())
    `;
    for (const bankId of bankIds) {
      await tx`
        insert into crm.product_banks (product_id, bank_id)
        values (${id}, ${bankId})
        on conflict do nothing
      `;
    }
  });
  clearSystemSettingsCache();
  return listPartnerProductBankRows();
}

function assertRangeUnique(
  existing: PartnerCommissionTable[],
  input: PartnerCommissionTableInput,
): void {
  const dup = existing.find(
    (row) =>
      row.productId === input.productId &&
      row.bankId === input.bankId &&
      row.id !== input.id &&
      row.rangeMinCents === input.rangeMinCents &&
      row.rangeMaxCents === input.rangeMaxCents,
  );
  if (dup) {
    throw new Error(
      "Já existe uma tabela com a mesma faixa de valor (mínimo e máximo iguais) para este produto e banco.",
    );
  }
}

export async function upsertPartnerCommissionTable(
  input: PartnerCommissionTableInput,
  actor: { userId: string; isMaster: boolean },
): Promise<PartnerCommissionTable[]> {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Informe o nome da tabela.");
  if (!input.productId) throw new Error("Produto obrigatório.");
  if (!input.bankId) throw new Error("Banco obrigatório.");
  if (input.rangeMaxCents < input.rangeMinCents) {
    throw new Error("Valor máximo deve ser maior ou igual ao mínimo.");
  }

  if (input.isDefault) {
    const category = String(input.partnerCategory || "").trim();
    if (!category) throw new Error("Selecione a categoria de parceiros para tabela padrão.");
  } else {
    const partners = input.partnerUserIds ?? [];
    if (!partners.length) throw new Error("Selecione ao menos um parceiro.");
  }

  if (input.fixedValueEnabled) {
    const minCents = Math.round(Number(input.fixedValueCents || 0));
    const maxCents = Math.round(
      Number(
        input.fixedValueMaxCents != null && input.fixedValueMaxCents !== undefined
          ? input.fixedValueMaxCents
          : input.fixedValueCents || 0,
      ),
    );
    if (!Number.isFinite(minCents) || minCents < 0 || !Number.isFinite(maxCents) || maxCents < 0) {
      throw new Error("Informe valor mínimo e máximo em R$.");
    }
    if (maxCents < minCents) {
      throw new Error("Valor máximo deve ser maior ou igual ao mínimo.");
    }
  } else {
    if (input.flatPercent < 0 || input.repassePercent < 0) {
      throw new Error("Percentuais não podem ser negativos.");
    }
    if (input.repassePercent > input.flatPercent && actor.isMaster === false) {
      // Pais: repasse do filho não pode exceder flat (que é o repasse do pai) — aviso suave no MVP
    }
  }

  const existing = await listPartnerCommissionTables({ isMaster: true });
  assertRangeUnique(existing, input);

  const id = input.id?.trim() || `pct-${randomUUID().slice(0, 10)}`;
  const fixed = Boolean(input.fixedValueEnabled);
  const fixedMinCents = fixed ? Math.round(Number(input.fixedValueCents || 0)) : null;
  const fixedMaxCents = fixed
    ? Math.round(
        Number(
          input.fixedValueMaxCents != null && input.fixedValueMaxCents !== undefined
            ? input.fixedValueMaxCents
            : input.fixedValueCents || 0,
        ),
      )
    : null;
  const flatPercent = fixed ? 0 : Number(input.flatPercent || 0);
  const repassePercent = fixed ? 0 : Number(input.repassePercent || 0);
  const flatCents = fixed ? fixedMinCents : null;
  const repasseCents = fixed ? fixedMaxCents : null;
  const fixedCents = fixed ? fixedMinCents : null;
  const partnerCategory = input.isDefault
    ? (String(input.partnerCategory || "").trim() as PartnerCategory)
    : null;
  const partnerUserIds = input.isDefault
    ? []
    : [...new Set((input.partnerUserIds || []).map((x) => String(x).trim()).filter(Boolean))];

  if (input.id) {
    const current = existing.find((t) => t.id === id);
    if (!current) throw new Error("Tabela não encontrada.");
    if (!actor.isMaster && current.createdByUserId !== actor.userId) {
      throw new Error("Você só pode editar tabelas que criou.");
    }
  }

  const sql = await getSql();
  await sql.begin(async (tx) => {
    await tx`
      insert into crm.partner_commission_tables (
        id, name, product_id, bank_id, is_default, partner_category,
        fixed_value_enabled, fixed_value_cents, flat_percent, repasse_percent,
        flat_cents, repasse_cents, range_min_cents, range_max_cents,
        created_by_user_id, created_at, updated_at
      ) values (
        ${id}, ${name}, ${input.productId}, ${input.bankId}, ${input.isDefault}, ${partnerCategory},
        ${fixed}, ${fixedCents}, ${flatPercent}, ${repassePercent},
        ${flatCents}, ${repasseCents}, ${input.rangeMinCents}, ${input.rangeMaxCents},
        ${actor.userId}, now(), now()
      )
      on conflict (id) do update set
        name = excluded.name,
        product_id = excluded.product_id,
        bank_id = excluded.bank_id,
        is_default = excluded.is_default,
        partner_category = excluded.partner_category,
        fixed_value_enabled = excluded.fixed_value_enabled,
        fixed_value_cents = excluded.fixed_value_cents,
        flat_percent = excluded.flat_percent,
        repasse_percent = excluded.repasse_percent,
        flat_cents = excluded.flat_cents,
        repasse_cents = excluded.repasse_cents,
        range_min_cents = excluded.range_min_cents,
        range_max_cents = excluded.range_max_cents,
        updated_at = now()
    `;
    await tx`delete from crm.partner_commission_table_partners where table_id = ${id}`;
    for (const partnerUserId of partnerUserIds) {
      await tx`
        insert into crm.partner_commission_table_partners (table_id, partner_user_id)
        values (${id}, ${partnerUserId})
      `;
    }
  });

  return listPartnerCommissionTables({
    isMaster: actor.isMaster,
    createdByUserId: actor.userId,
  });
}

export async function deletePartnerCommissionTable(
  tableId: string,
  actor: { userId: string; isMaster: boolean },
): Promise<PartnerCommissionTable[]> {
  const existing = await listPartnerCommissionTables({ isMaster: true });
  const current = existing.find((t) => t.id === tableId);
  if (!current) throw new Error("Tabela não encontrada.");
  if (!actor.isMaster && current.createdByUserId !== actor.userId) {
    throw new Error("Você só pode excluir tabelas que criou.");
  }
  const sql = await getSql();
  await sql`delete from crm.partner_commission_tables where id = ${tableId}`;
  return listPartnerCommissionTables({
    isMaster: actor.isMaster,
    createdByUserId: actor.userId,
  });
}
