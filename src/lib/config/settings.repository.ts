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

const DATA_DIR = join(process.cwd(), "data");
const SETTINGS_FILE = join(DATA_DIR, "system-settings.json");

export type SettingsSaveSection =
  | "categories"
  | "products"
  | "banks"
  | "attendanceStatuses"
  | "all";

let cachedSettings: SystemSettings | null = null;

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

  const [categories, menus, products, productFields, banks, attendanceStatuses] = await Promise.all([
    sql<{ id: string; name: string; home_menu_id: string | null }[]>`
      select id, name, home_menu_id from crm.user_categories order by name
    `,
    sql<{ category_id: string; menu_id: string }[]>`
      select category_id, menu_id from crm.user_category_menus
    `,
    sql<{ id: string; name: string }[]>`
      select id, name from crm.products order by name
    `,
    sql<{ product_id: string; field_id: string; required: boolean }[]>`
      select product_id, field_id, required from crm.product_fields
    `,
    sql<{ id: string; name: string }[]>`
      select id, name from crm.banks order by name
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

  return normalizeSettings({
    categories: categories.map((category) => ({
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
        requiredFieldIds: fields.required,
        availableFieldIds: fields.optional,
      };
    }),
    banks: banks.map((bank) => ({ id: bank.id, name: bank.name })),
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
    await tx`delete from crm.user_category_menus`;
    await tx`delete from crm.user_categories`;
    return;
  }

  const payload = categories.map((category) => ({
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
      where not exists (select 1 from input i where i.id = m.category_id)
      returning 1
    ),
    del_cats as (
      delete from crm.user_categories c
      where not exists (select 1 from input i where i.id = c.id)
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
    await tx`delete from crm.product_fields`;
    await tx`delete from crm.products`;
    return;
  }

  const payload = products.map((product) => ({
    id: product.id,
    name: product.name,
    required_field_ids: product.requiredFieldIds,
  }));

  await tx`
    with input as (
      select *
      from jsonb_to_recordset(${tx.json(payload)}) as x(id text, name text, required_field_ids jsonb)
    ),
    del_field_orphans as (
      delete from crm.product_fields f
      where not exists (select 1 from input i where i.id = f.product_id)
      returning 1
    ),
    del_products as (
      delete from crm.products p
      where not exists (select 1 from input i where i.id = p.id)
      returning 1
    ),
    upsert_products as (
      insert into crm.products (id, name, updated_at)
      select id, name, now() from input
      on conflict (id) do update set name = excluded.name, updated_at = now()
      returning id
    ),
    del_fields as (
      delete from crm.product_fields f
      using input i
      where f.product_id = i.id
      returning 1
    )
    select 1
  `;

  await tx`
    insert into crm.product_fields (product_id, field_id, required)
    select i.id, field_id, true
    from jsonb_to_recordset(${tx.json(payload)}) as i(id text, name text, required_field_ids jsonb)
    cross join lateral jsonb_array_elements_text(coalesce(i.required_field_ids, '[]'::jsonb)) as field_id
    on conflict (product_id, field_id) do update set required = excluded.required
  `;
}

async function syncBanks(tx: Tx, banks: BankConfig[]): Promise<void> {
  if (banks.length === 0) {
    await tx`delete from crm.banks`;
    return;
  }

  const payload = banks.map((bank) => ({ id: bank.id, name: bank.name }));

  await tx`
    with input as (
      select * from jsonb_to_recordset(${tx.json(payload)}) as x(id text, name text)
    ),
    del_banks as (
      delete from crm.banks b
      where not exists (select 1 from input i where i.id = b.id)
      returning 1
    ),
    upsert_banks as (
      insert into crm.banks (id, name, updated_at)
      select id, name, now() from input
      on conflict (id) do update set name = excluded.name, updated_at = now()
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
    if (section === "all" || section === "categories") {
      await syncCategories(tx, next.categories);
    }
    if (section === "all" || section === "products") {
      await syncProducts(tx, next.products);
    }
    if (section === "all" || section === "banks") {
      await syncBanks(tx, next.banks);
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
