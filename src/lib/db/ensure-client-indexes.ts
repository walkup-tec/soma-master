import { DEFAULT_ATTENDANCE_STATUSES } from "@/lib/config/settings-defaults";
import { ensureChatSchema } from "@/lib/chat/ensure-chat-schema";
import type { Sql } from "@/lib/db/postgres";

let ensured = false;

async function ensureClientProductsTable(sql: Sql): Promise<void> {
  await sql`
    create table if not exists crm.client_products (
      client_id text not null references crm.clients(id) on delete cascade,
      product_id text not null references crm.products(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (client_id, product_id)
    )
  `;
  await sql`
    create index if not exists idx_client_products_product
    on crm.client_products (product_id)
  `;
}

async function ensureAttendanceStatusColorColumn(sql: Sql): Promise<void> {
  await sql`
    alter table crm.attendance_statuses
    add column if not exists color text not null default '#64748b'
  `;
  await sql`
    alter table crm.attendance_statuses
    add column if not exists auto_return_days int null
  `;
  for (const status of DEFAULT_ATTENDANCE_STATUSES) {
    await sql`
      update crm.attendance_statuses
      set color = ${status.color}
      where id = ${status.id}
        and (color is null or color = '' or color = '#64748b')
    `;
  }
}

/** Provisiona schema auxiliar uma vez por processo — evita DDL em toda ação. */
export async function ensureClientListIndexes(sql: Sql): Promise<void> {
  if (ensured) return;

  const [{ ready }] = await sql<{ ready: boolean }[]>`
    select exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'crm'
        and c.relname = 'idx_client_schedules_contact_date'
    ) as ready
  `;

  if (ready) {
    await ensureClientProductsTable(sql);
    await ensureAttendanceStatusColorColumn(sql);
    await ensureChatSchema(sql);
    ensured = true;
    return;
  }

  ensured = true;

  await sql`
    create index if not exists idx_clients_created_at
    on crm.clients (created_at desc)
  `;
  await sql`
    create index if not exists idx_client_assignments_user_client
    on crm.client_assignments (user_id, client_id)
  `;
  await sql`
    create table if not exists crm.client_attendances (
      id text primary key,
      client_id text not null references crm.clients(id) on delete cascade,
      user_id text not null references crm.users(id),
      user_name text not null,
      note text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create index if not exists idx_client_attendances_client_created
    on crm.client_attendances (client_id, created_at desc)
  `;
  await sql`
    create table if not exists crm.client_attachments (
      id text primary key,
      client_id text not null references crm.clients(id) on delete cascade,
      user_id text not null references crm.users(id),
      user_name text not null,
      file_name text not null,
      file_size bigint not null,
      mime_type text,
      storage_path text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create index if not exists idx_client_attachments_client_created
    on crm.client_attachments (client_id, created_at desc)
  `;
  await sql`
    create table if not exists crm.client_schedules (
      id text primary key,
      client_id text not null unique references crm.clients(id) on delete cascade,
      user_id text not null references crm.users(id),
      user_name text not null,
      contact_date date not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create index if not exists idx_client_schedules_contact_date
    on crm.client_schedules (contact_date)
  `;
  await sql`
    create table if not exists crm.attendance_statuses (
      id text primary key,
      label text not null,
      sort_order int not null default 0,
      updated_at timestamptz not null default now()
    )
  `;

  await ensureClientProductsTable(sql);
  await ensureAttendanceStatusColorColumn(sql);

  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from crm.attendance_statuses
  `;
  if ((count ?? 0) === 0) {
    const rows = DEFAULT_ATTENDANCE_STATUSES.map((status, index) => ({
      id: status.id,
      label: status.label,
      color: status.color,
      auto_return_days: status.autoReturnDays,
      sort_order: index + 1,
    }));
    await sql`
      insert into crm.attendance_statuses ${sql(rows)}
      on conflict (id) do nothing
    `;
  }

  await ensureChatSchema(sql);
}
