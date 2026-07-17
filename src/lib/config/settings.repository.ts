import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_SYSTEM_SETTINGS, normalizeSettings } from "@/lib/config/settings-defaults";
import type {
  AttendanceStatusConfig,
  BankConfig,
  ProductConfig,
  SystemSettings,
  UserCategory,
} from "@/lib/config/settings-types";
import type { MenuItemId } from "@/lib/config/menu-items";
import type postgres from "postgres";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";
import { isPartnerLinkedUserCategoryId } from "@/lib/partners/partner.constants";

const DATA_DIR = join(process.cwd(), "data");
const SETTINGS_FILE = join(DATA_DIR, "system-settings.json");

export type SettingsSaveSection =
  | "categories"
  | "products"
  | "banks"
  | "attendanceStatuses"
  | "all";

let cachedSettings: SystemSettings | null = null;

export function clearSystemSettingsCache(): void {
  cachedSettings = null;
}

type Tx = postgres.TransactionSql<Record<string, never>>;

async function loadSystemSettingsFromPostgres(): Promise<SystemSettings> {
  const sql = await getSql();
  await sql`
    alter table crm.attendance_statuses
    add column if not exists color text not null default '#64748b'
  `;
  await sql`
    alter table crm.attendance_statuses
    add column if not exists auto_return_days int null
  `;

  await sql`
    alter table crm.user_categories
    add column if not exists home_menu_id text not null default 'dashboard'
  `;
  await sql`
    alter table crm.products
    add column if not exists tag text not null default ''
  `;
  await sql`
    alter table crm.products
    add column if not exists color text not null default '#64748b'
  `;
  await sql`
    alter table crm.products
    add column if not exists available_for_partners boolean not null default false
  `;
  await sql`
    alter table crm.banks
    add column if not exists storm_access_enabled boolean not null default false
  `;
  await sql`
    alter table crm.banks
    add column if not exists storm_username text not null default ''
  `;
  await sql`
    alter table crm.banks
    add column if not exists storm_password text not null default ''
  `;
  await sql`
    alter table crm.banks
    add column if not exists bank_access_enabled boolean not null default false
  `;
  await sql`
    alter table crm.banks
    add column if not exists bank_username text not null default ''
  `;
  await sql`
    alter table crm.banks
    add column if not exists bank_password text not null default ''
  `;
  await sql`
    alter table crm.banks
    add column if not exists operational_guide_enabled boolean not null default false
  `;
  await sql`
    alter table crm.banks
    add column if not exists operational_guide_display_name text not null default ''
  `;
  await sql`
    alter table crm.banks
    add column if not exists operational_guide_file_name text not null default ''
  `;
  await sql`
    alter table crm.banks
    add column if not exists operational_guide_storage_id text not null default ''
  `;
  await sql`
    create table if not exists crm.product_banks (
      product_id text not null references crm.products(id) on delete cascade,
      bank_id text not null references crm.banks(id) on delete cascade,
      primary key (product_id, bank_id)
    )
  `;

  const [categories, menus, products, productFields, productBanks, banks, attendanceStatuses] =
    await Promise.all([
    sql<{ id: string; name: string; home_menu_id: string | null }[]>`
      select id, name, home_menu_id from crm.user_categories order by name
    `,
    sql<{ category_id: string; menu_id: string }[]>`
      select category_id, menu_id from crm.user_category_menus
    `,
    sql<
      {
        id: string;
        name: string;
        tag: string | null;
        color: string | null;
        available_for_partners: boolean | null;
      }[]
    >`
      select id, name, tag, color, available_for_partners from crm.products order by name
    `,
    sql<{ product_id: string; field_id: string; required: boolean }[]>`
      select product_id, field_id, required from crm.product_fields
    `,
    sql<{ product_id: string; bank_id: string }[]>`
      select product_id, bank_id from crm.product_banks
    `,
    sql<
      {
        id: string;
        name: string;
        storm_access_enabled: boolean | null;
        storm_username: string | null;
        storm_password: string | null;
        bank_access_enabled: boolean | null;
        bank_username: string | null;
        bank_password: string | null;
        operational_guide_enabled: boolean | null;
        operational_guide_display_name: string | null;
        operational_guide_file_name: string | null;
        operational_guide_storage_id: string | null;
      }[]
    >`
      select
        id, name,
        storm_access_enabled, storm_username, storm_password,
        bank_access_enabled, bank_username, bank_password,
        operational_guide_enabled,
        operational_guide_display_name, operational_guide_file_name, operational_guide_storage_id
      from crm.banks
      order by name
    `,
    sql<
      { id: string; label: string; color: string | null; auto_return_days: number | null; sort_order: number }[]
    >`
      select id, label, color, auto_return_days, sort_order
      from crm.attendance_statuses
      order by sort_order, label
    `,
  ]);

  const menuMap = new Map<string, MenuItemId[]>();
  for (const row of menus) {
    const list = menuMap.get(row.category_id) ?? [];
    list.push(row.menu_id as MenuItemId);
    menuMap.set(row.category_id, list);
  }

  const fieldsByProduct = new Map<string, { required: string[]; optional: string[] }>();
  for (const row of productFields) {
    const entry = fieldsByProduct.get(row.product_id) ?? { required: [], optional: [] };
    if (row.required) entry.required.push(row.field_id);
    else entry.optional.push(row.field_id);
    fieldsByProduct.set(row.product_id, entry);
  }

  const banksByProduct = new Map<string, string[]>();
  for (const row of productBanks) {
    const list = banksByProduct.get(row.product_id) ?? [];
    list.push(row.bank_id);
    banksByProduct.set(row.product_id, list);
  }

  return normalizeSettings({
    categories: categories
      .filter((category) => !isPartnerLinkedUserCategoryId(category.id))
      .map((category) => ({
        id: category.id,
        name: category.name,
        menuIds: menuMap.get(category.id) ?? [],
        homeMenuId: (category.home_menu_id as MenuItemId | null) ?? "dashboard",
      })),
    products: products.map((product) => {
      const fields = fieldsByProduct.get(product.id) ?? { required: [], optional: [] };
      return {
        id: product.id,
        name: product.name,
        tag: product.tag ?? "",
        color: product.color ?? "#64748b",
        bankIds: banksByProduct.get(product.id) ?? [],
        availableForPartners: Boolean(product.available_for_partners),
        requiredFieldIds: fields.required,
        availableFieldIds: fields.optional,
      };
    }),
    banks: banks.map((bank) => {
      const storageId = String(bank.operational_guide_storage_id ?? "").trim();
      return {
        id: bank.id,
        name: bank.name,
        stormAccessEnabled: Boolean(bank.storm_access_enabled),
        stormUsername: bank.storm_username ?? "",
        stormPassword: bank.storm_password ?? "",
        bankAccessEnabled: Boolean(bank.bank_access_enabled),
        bankUsername: bank.bank_username ?? "",
        bankPassword: bank.bank_password ?? "",
        operationalGuideEnabled: Boolean(bank.operational_guide_enabled),
        operationalGuide: storageId
          ? {
              displayName: bank.operational_guide_display_name ?? "",
              fileName: bank.operational_guide_file_name ?? "",
              storageId,
            }
          : null,
      };
    }),
    attendanceStatuses:
      attendanceStatuses.length > 0
        ? attendanceStatuses.map((status) => ({
            id: status.id,
            label: status.label,
            color: status.color ?? "#64748b",
            autoReturnDays: status.auto_return_days,
          }))
        : undefined,
  } as SystemSettings);
}

async function syncCategories(tx: Tx, categories: UserCategory[]): Promise<void> {
  if (categories.length === 0) {
    // Não apaga partner-cat-* (FK técnica de parceiros).
    await tx`
      delete from crm.user_category_menus m
      where m.category_id not like 'partner-cat-%'
    `;
    await tx`
      delete from crm.user_categories c
      where c.id not like 'partner-cat-%'
    `;
    return;
  }

  const payload = categories
    .filter((category) => !isPartnerLinkedUserCategoryId(category.id))
    .map((category) => ({
      id: category.id,
      name: category.name,
      menu_ids: category.menuIds,
      home_menu_id: category.homeMenuId,
    }));

  await tx`
    with input as (
      select *
      from jsonb_to_recordset(${tx.json(payload)}) as x(
        id text,
        name text,
        menu_ids jsonb,
        home_menu_id text
      )
    ),
    del_menu_orphans as (
      delete from crm.user_category_menus m
      where m.category_id not like 'partner-cat-%'
        and not exists (select 1 from input i where i.id = m.category_id)
      returning 1
    ),
    del_cats as (
      delete from crm.user_categories c
      where c.id not like 'partner-cat-%'
        and not exists (select 1 from input i where i.id = c.id)
      returning 1
    ),
    upsert_cats as (
      insert into crm.user_categories (id, name, home_menu_id, updated_at)
      select id, name, coalesce(nullif(home_menu_id, ''), 'dashboard'), now() from input
      on conflict (id) do update
        set name = excluded.name,
            home_menu_id = excluded.home_menu_id,
            updated_at = now()
      returning id
    ),
    del_menus as (
      delete from crm.user_category_menus m
      using input i
      where m.category_id = i.id
      returning 1
    )
    select 1
  `;

  await tx`
    insert into crm.user_category_menus (category_id, menu_id)
    select i.id, menu_id
    from jsonb_to_recordset(${tx.json(payload)}) as i(
      id text,
      name text,
      menu_ids jsonb,
      home_menu_id text
    )
    cross join lateral jsonb_array_elements_text(coalesce(i.menu_ids, '[]'::jsonb)) as menu_id
    on conflict (category_id, menu_id) do nothing
  `;
}

async function syncProducts(tx: Tx, products: ProductConfig[]): Promise<void> {
  if (products.length === 0) {
    await tx`delete from crm.product_banks`;
    await tx`delete from crm.product_fields`;
    await tx`delete from crm.products`;
    return;
  }

  const payload = products.map((product) => ({
    id: product.id,
    name: product.name,
    tag: product.tag || "",
    color: product.color || "#64748b",
    available_for_partners: Boolean(product.availableForPartners),
    required_field_ids: product.requiredFieldIds,
    bank_ids: product.bankIds ?? [],
  }));

  await tx`
    with input as (
      select *
      from jsonb_to_recordset(${tx.json(payload)}) as x(
        id text,
        name text,
        tag text,
        color text,
        available_for_partners boolean,
        required_field_ids jsonb,
        bank_ids jsonb
      )
    ),
    del_field_orphans as (
      delete from crm.product_fields f
      where not exists (select 1 from input i where i.id = f.product_id)
      returning 1
    ),
    del_bank_orphans as (
      delete from crm.product_banks b
      where not exists (select 1 from input i where i.id = b.product_id)
      returning 1
    ),
    del_products as (
      delete from crm.products p
      where not exists (select 1 from input i where i.id = p.id)
      returning 1
    ),
    upsert_products as (
      insert into crm.products (id, name, tag, color, available_for_partners, updated_at)
      select id, name, tag, color, available_for_partners, now() from input
      on conflict (id) do update set
        name = excluded.name,
        tag = excluded.tag,
        color = excluded.color,
        available_for_partners = excluded.available_for_partners,
        updated_at = now()
      returning id
    ),
    del_fields as (
      delete from crm.product_fields f
      using input i
      where f.product_id = i.id
      returning 1
    ),
    del_banks as (
      delete from crm.product_banks b
      using input i
      where b.product_id = i.id
      returning 1
    )
    select 1
  `;

  await tx`
    insert into crm.product_fields (product_id, field_id, required)
    select i.id, field_id, true
    from jsonb_to_recordset(${tx.json(payload)}) as i(
      id text,
      name text,
      tag text,
      color text,
      available_for_partners boolean,
      required_field_ids jsonb,
      bank_ids jsonb
    )
    cross join lateral jsonb_array_elements_text(coalesce(i.required_field_ids, '[]'::jsonb)) as field_id
    on conflict (product_id, field_id) do update set required = excluded.required
  `;

  await tx`
    insert into crm.product_banks (product_id, bank_id)
    select i.id, bank_id
    from jsonb_to_recordset(${tx.json(payload)}) as i(
      id text,
      name text,
      tag text,
      color text,
      available_for_partners boolean,
      required_field_ids jsonb,
      bank_ids jsonb
    )
    cross join lateral jsonb_array_elements_text(coalesce(i.bank_ids, '[]'::jsonb)) as bank_id
    where exists (select 1 from crm.banks b where b.id = bank_id)
    on conflict do nothing
  `;
}

async function syncBanks(tx: Tx, banks: BankConfig[]): Promise<void> {
  if (banks.length === 0) {
    await tx`delete from crm.product_banks`;
    await tx`delete from crm.banks`;
    return;
  }

  const payload = banks.map((bank) => ({
    id: bank.id,
    name: bank.name,
    storm_access_enabled: Boolean(bank.stormAccessEnabled),
    storm_username: bank.stormUsername || "",
    storm_password: bank.stormPassword || "",
    bank_access_enabled: Boolean(bank.bankAccessEnabled),
    bank_username: bank.bankUsername || "",
    bank_password: bank.bankPassword || "",
    operational_guide_enabled: Boolean(bank.operationalGuideEnabled),
    operational_guide_display_name: bank.operationalGuide?.displayName || "",
    operational_guide_file_name: bank.operationalGuide?.fileName || "",
    operational_guide_storage_id: bank.operationalGuide?.storageId || "",
  }));

  await tx`
    with input as (
      select * from jsonb_to_recordset(${tx.json(payload)}) as x(
        id text,
        name text,
        storm_access_enabled boolean,
        storm_username text,
        storm_password text,
        bank_access_enabled boolean,
        bank_username text,
        bank_password text,
        operational_guide_enabled boolean,
        operational_guide_display_name text,
        operational_guide_file_name text,
        operational_guide_storage_id text
      )
    ),
    del_banks as (
      delete from crm.banks b
      where not exists (select 1 from input i where i.id = b.id)
      returning 1
    ),
    upsert_banks as (
      insert into crm.banks (
        id, name,
        storm_access_enabled, storm_username, storm_password,
        bank_access_enabled, bank_username, bank_password,
        operational_guide_enabled,
        operational_guide_display_name, operational_guide_file_name, operational_guide_storage_id,
        updated_at
      )
      select
        id, name,
        storm_access_enabled, storm_username, storm_password,
        bank_access_enabled, bank_username, bank_password,
        operational_guide_enabled,
        operational_guide_display_name, operational_guide_file_name, operational_guide_storage_id,
        now()
      from input
      on conflict (id) do update set
        name = excluded.name,
        storm_access_enabled = excluded.storm_access_enabled,
        storm_username = excluded.storm_username,
        storm_password = excluded.storm_password,
        bank_access_enabled = excluded.bank_access_enabled,
        bank_username = excluded.bank_username,
        bank_password = excluded.bank_password,
        operational_guide_enabled = excluded.operational_guide_enabled,
        operational_guide_display_name = excluded.operational_guide_display_name,
        operational_guide_file_name = excluded.operational_guide_file_name,
        operational_guide_storage_id = excluded.operational_guide_storage_id,
        updated_at = now()
      returning id
    )
    select 1
  `;
}

async function syncAttendanceStatuses(tx: Tx, statuses: AttendanceStatusConfig[]): Promise<void> {
  if (statuses.length === 0) {
    await tx`delete from crm.attendance_statuses`;
    return;
  }

  const payload = statuses.map((status, index) => ({
    id: status.id,
    label: status.label,
    color: status.color,
    auto_return_days: status.autoReturnDays,
    sort_order: index + 1,
  }));

  await tx`
    with input as (
      select *
      from jsonb_to_recordset(${tx.json(payload)}) as x(
        id text, label text, color text, auto_return_days int, sort_order int
      )
    ),
    del_statuses as (
      delete from crm.attendance_statuses s
      where not exists (select 1 from input i where i.id = s.id)
      returning 1
    ),
    upsert_statuses as (
      insert into crm.attendance_statuses (id, label, color, auto_return_days, sort_order, updated_at)
      select id, label, color, auto_return_days, sort_order, now() from input
      on conflict (id) do update set
        label = excluded.label,
        color = excluded.color,
        auto_return_days = excluded.auto_return_days,
        sort_order = excluded.sort_order,
        updated_at = now()
      returning id
    )
    select 1
  `;
}

function mergeSettingsForSection(
  base: SystemSettings,
  incoming: SystemSettings,
  section: SettingsSaveSection,
): SystemSettings {
  return normalizeSettings({
    categories: section === "all" || section === "categories" ? incoming.categories : base.categories,
    products: section === "all" || section === "products" ? incoming.products : base.products,
    banks: section === "all" || section === "banks" ? incoming.banks : base.banks,
    attendanceStatuses:
      section === "all" || section === "attendanceStatuses"
        ? incoming.attendanceStatuses
        : base.attendanceStatuses,
  });
}

async function saveSystemSettingsToPostgres(
  settings: SystemSettings,
  section: SettingsSaveSection = "all",
): Promise<SystemSettings> {
  const incoming = normalizeSettings(settings);
  const base = cachedSettings ?? (await loadSystemSettingsFromPostgres());
  const next = mergeSettingsForSection(base, incoming, section);
  const sql = await getSql();

  await sql.begin(async (tx) => {
    if (section === "all" || section === "banks") {
      await syncBanks(tx, next.banks);
    }
    if (section === "all" || section === "products") {
      await syncProducts(tx, next.products);
    }
    if (section === "all" || section === "categories") {
      await syncCategories(tx, next.categories);
    }
    if (section === "all" || section === "attendanceStatuses") {
      await syncAttendanceStatuses(tx, next.attendanceStatuses);
    }
  });

  cachedSettings = next;
  return next;
}

export async function loadSystemSettingsFromDisk(): Promise<SystemSettings> {
  if (isDatabaseEnabled()) {
    if (!cachedSettings) {
      cachedSettings = await loadSystemSettingsFromPostgres();
    }
    // Reaplica normalize para migrações de menu (ex.: kanban após clientes).
    cachedSettings = normalizeSettings(cachedSettings);
    return cachedSettings;
  }

  if (!cachedSettings) {
    try {
      const raw = await readFile(SETTINGS_FILE, "utf8");
      cachedSettings = normalizeSettings({
        ...DEFAULT_SYSTEM_SETTINGS,
        ...JSON.parse(raw),
      } as SystemSettings);
    } catch {
      cachedSettings = normalizeSettings(DEFAULT_SYSTEM_SETTINGS);
    }
  }

  cachedSettings = normalizeSettings(cachedSettings);
  return cachedSettings;
}

export async function saveSystemSettingsToDisk(
  settings: SystemSettings,
  section: SettingsSaveSection = "all",
): Promise<SystemSettings> {
  if (isDatabaseEnabled()) {
    return saveSystemSettingsToPostgres(settings, section);
  }

  const base = cachedSettings ?? (await loadSystemSettingsFromDisk());
  const normalized = mergeSettingsForSection(base, normalizeSettings(settings), section);
  cachedSettings = normalized;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

export function getMenuIdsForCategory(settings: SystemSettings, categoryId: string): MenuItemId[] {
  const category = settings.categories.find((item) => item.id === categoryId);
  return category?.menuIds ?? [];
}

export function getHomeMenuIdForCategory(
  settings: SystemSettings,
  categoryId: string,
): MenuItemId {
  const category = settings.categories.find((item) => item.id === categoryId);
  if (!category) return "dashboard";
  return category.homeMenuId;
}

export function invalidateSettingsCache(): void {
  cachedSettings = null;
}
