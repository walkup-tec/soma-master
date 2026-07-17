import { MASTER_USER_ID } from "@/lib/auth/master-user";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/config/settings-defaults";
import type { Sql } from "@/lib/db/postgres";
import {
  LEGACY_PARTNER_ONLY_CATEGORY_IDS,
  PARTNER_CATEGORIES,
  partnerCategoryUserCategoryId,
} from "@/lib/partners/partner.constants";

let ensured = false;

/** Provisiona o domínio Parceiros de forma idempotente durante o boot. */
export async function ensurePartnerSchema(sql: Sql): Promise<void> {
  if (ensured) return;

  await sql.begin(async (tx) => {
    // Categorias técnicas só para FK de parceiros — prefixo partner-cat-* (não misturar com usuário).
    for (const { value, label } of PARTNER_CATEGORIES) {
      const id = partnerCategoryUserCategoryId(value);
      await tx`
        insert into crm.user_categories (id, name, home_menu_id)
        values (${id}, ${label}, 'parceiros')
        on conflict (id) do update set name = excluded.name
      `;
      await tx`
        insert into crm.user_category_menus (category_id, menu_id)
        values (${id}, 'parceiros')
        on conflict do nothing
      `;
    }

    await tx`
      create table if not exists crm.partner_profiles (
        user_id text primary key references crm.users(id) on delete cascade,
        parent_user_id text null references crm.users(id) on delete restrict,
        partner_category text not null default 'atendente'
          check (partner_category in ('substabelecido', 'gerente', 'suporte', 'corban', 'atendente')),
        person_type text not null default 'pf'
          check (person_type in ('pf', 'pj')),
        tax_id text null,
        rg text not null default '',
        phone text not null default '',
        whatsapp text not null default '',
        pix_key_type text not null default 'cpf'
          check (pix_key_type in ('cpf', 'phone', 'email', 'random')),
        pix_key text not null default '',
        cep text not null default '',
        street text not null default '',
        neighborhood text not null default '',
        city text not null default '',
        state text not null default '',
        complement text not null default '',
        number text not null default '',
        status text not null default 'active'
          check (status in ('active', 'inactive', 'blocked')),
        blocked_reason text null,
        blocked_at timestamptz null,
        blocked_by_user_id text null references crm.users(id) on delete set null,
        can_create_partners boolean not null default false,
        uses_custom_menu_permissions boolean not null default false,
        has_production boolean not null default false,
        created_by_user_id text null references crm.users(id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        check (user_id <> parent_user_id),
        check (
          status <> 'blocked'
          or (blocked_reason is not null and length(trim(blocked_reason)) > 0)
        )
      )
    `;

    await tx`
      do $migration$
      begin
        if exists (
          select 1
          from pg_constraint
          where conname = 'partner_profiles_partner_category_check'
            and conrelid = 'crm.partner_profiles'::regclass
            and pg_get_constraintdef(oid) not like '%corban%'
        ) then
          alter table crm.partner_profiles
          drop constraint partner_profiles_partner_category_check;
          alter table crm.partner_profiles
          add constraint partner_profiles_partner_category_check
          check (partner_category in ('substabelecido', 'gerente', 'suporte', 'corban', 'atendente'));
        elsif not exists (
          select 1
          from pg_constraint
          where conname = 'partner_profiles_partner_category_check'
            and conrelid = 'crm.partner_profiles'::regclass
        ) then
          alter table crm.partner_profiles
          add constraint partner_profiles_partner_category_check
          check (partner_category in ('substabelecido', 'gerente', 'suporte', 'corban', 'atendente'));
        end if;
      end
      $migration$
    `;

    await tx`
      create unique index if not exists uq_partner_profiles_tax_id
      on crm.partner_profiles (tax_id)
      where tax_id is not null and tax_id <> ''
    `;
    await tx`
      alter table crm.partner_profiles
      add column if not exists uses_custom_menu_permissions boolean not null default false
    `;
    await tx`
      create index if not exists idx_partner_profiles_parent
      on crm.partner_profiles (parent_user_id)
    `;
    await tx`
      create index if not exists idx_partner_profiles_status_created
      on crm.partner_profiles (status, created_at desc)
    `;

    await tx`
      create table if not exists crm.user_menu_permissions (
        user_id text not null references crm.users(id) on delete cascade,
        menu_id text not null,
        created_at timestamptz not null default now(),
        primary key (user_id, menu_id)
      )
    `;

    await tx`
      create table if not exists crm.partner_banks (
        partner_user_id text not null references crm.users(id) on delete cascade,
        bank_id text not null,
        created_at timestamptz not null default now(),
        primary key (partner_user_id, bank_id)
      )
    `;
    await tx`
      create index if not exists idx_partner_banks_bank_partner
      on crm.partner_banks (bank_id, partner_user_id)
    `;

    await tx`
      create table if not exists crm.partner_events (
        id text primary key,
        partner_user_id text not null references crm.users(id) on delete cascade,
        actor_user_id text not null references crm.users(id) on delete restrict,
        actor_name text not null,
        action text not null
          check (action in ('created', 'updated', 'activated', 'inactivated', 'blocked', 'unblocked')),
        reason text null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    `;
    await tx`
      create index if not exists idx_partner_events_partner_created
      on crm.partner_events (partner_user_id, created_at desc)
    `;

    await tx`
      insert into crm.partner_profiles (
        user_id, parent_user_id, partner_category, person_type, status,
        can_create_partners, created_by_user_id, created_at, updated_at
      )
      select
        u.id,
        case when u.role = 'master' then null else ${MASTER_USER_ID} end,
        case
          when u.role = 'master' then 'substabelecido'
          when lower(coalesce(c.name, '')) like '%gerente%' then 'gerente'
          when lower(coalesce(c.name, '')) like '%suporte%' then 'suporte'
          when lower(coalesce(c.name, '')) like '%corban%' then 'corban'
          when lower(coalesce(c.name, '')) like '%substabelecido%' then 'substabelecido'
          else 'atendente'
        end,
        'pf',
        'active',
        u.role = 'master',
        case when u.role = 'master' then null else ${MASTER_USER_ID} end,
        u.created_at,
        now()
      from crm.users u
      left join crm.user_categories c on c.id = u.category_id
      on conflict (user_id) do nothing
    `;

    // Parceiros usam partner-cat-*; master permanece em cat-master.
    await tx`
      update crm.users u
      set category_id = 'partner-cat-' || p.partner_category,
          updated_at = now()
      from crm.partner_profiles p
      where p.user_id = u.id
        and u.id <> ${MASTER_USER_ID}
        and u.category_id is distinct from ('partner-cat-' || p.partner_category)
    `;

    // Restaura Master / Atendente / Gerente se ainda estiverem corrompidos pelo seed antigo
    // (home_menu_id = 'parceiros') ou se a linha não existir. Não sobrescreve customizações válidas.
    for (const category of DEFAULT_SYSTEM_SETTINGS.categories) {
      const existing = await tx<{ home_menu_id: string }[]>`
        select home_menu_id from crm.user_categories where id = ${category.id} limit 1
      `;
      const needsRestore =
        existing.length === 0 || existing[0]?.home_menu_id === "parceiros";
      if (!needsRestore) continue;

      await tx`
        insert into crm.user_categories (id, name, home_menu_id)
        values (${category.id}, ${category.name}, ${category.homeMenuId})
        on conflict (id) do update set
          name = excluded.name,
          home_menu_id = excluded.home_menu_id
      `;
      await tx`delete from crm.user_category_menus where category_id = ${category.id}`;
      for (const menuId of category.menuIds) {
        await tx`
          insert into crm.user_category_menus (category_id, menu_id)
          values (${category.id}, ${menuId})
          on conflict do nothing
        `;
      }
    }

    // Remove categorias legadas só-parceiro se ninguém mais aponta para elas.
    for (const legacyId of LEGACY_PARTNER_ONLY_CATEGORY_IDS) {
      await tx`
        delete from crm.user_category_menus m
        where m.category_id = ${legacyId}
          and not exists (select 1 from crm.users u where u.category_id = ${legacyId})
      `;
      await tx`
        delete from crm.user_categories c
        where c.id = ${legacyId}
          and not exists (select 1 from crm.users u where u.category_id = ${legacyId})
      `;
    }
  });

  // Evita cache de settings com categorias de parceiro misturadas.
  const { clearSystemSettingsCache } = await import("@/lib/config/settings.repository");
  clearSystemSettingsCache();

  ensured = true;
}
