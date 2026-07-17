import { ALL_MENU_ITEM_IDS, type MenuItemId } from "@/lib/config/menu-items";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";
import { partnerCategoryUserCategoryId } from "@/lib/partners/partner.constants";
import type {
  PartnerEventAction,
  PartnerEventRecord,
  PartnerListQuery,
  PartnerListResult,
  PartnerRecord,
  PartnerStatus,
  PartnerUpsertInput,
} from "@/lib/partners/partner.types";

type PartnerRow = {
  user_id: string;
  parent_user_id: string | null;
  parent_name: string | null;
  name: string;
  email: string;
  partner_category: PartnerRecord["category"];
  person_type: PartnerRecord["personType"];
  tax_id: string | null;
  rg: string;
  phone: string;
  whatsapp: string;
  pix_key_type: PartnerRecord["pixKeyType"];
  pix_key: string;
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
  number: string;
  status: PartnerStatus;
  blocked_reason: string | null;
  has_block_history: boolean;
  can_create_partners: boolean;
  has_production: boolean;
  menu_ids: string[];
  bank_ids: string[];
  created_at: Date;
  updated_at: Date;
};

type PartnerAccessRow = {
  status: PartnerStatus;
  can_create_partners: boolean;
  uses_custom_menu_permissions: boolean;
  menu_ids: string[];
};

function requireDatabase(): void {
  if (!isDatabaseEnabled()) {
    throw new Error("A área Parceiros requer conexão com o banco de dados.");
  }
}

function mapPartner(row: PartnerRow): PartnerRecord {
  return {
    id: row.user_id,
    parentUserId: row.parent_user_id,
    parentName: row.parent_name,
    name: row.name,
    category: row.partner_category,
    personType: row.person_type,
    taxId: row.tax_id ?? "",
    rg: row.rg,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    pixKeyType: row.pix_key_type,
    pixKey: row.pix_key,
    cep: row.cep,
    street: row.street,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    complement: row.complement,
    number: row.number,
    status: row.status,
    blockedReason: row.blocked_reason,
    hasBlockHistory: row.has_block_history,
    canCreatePartners: row.can_create_partners,
    hasProduction: row.has_production,
    menuIds: row.menu_ids as MenuItemId[],
    bankIds: row.bank_ids,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function categoryIdForPartner(category: PartnerRecord["category"]): string {
  return `cat-${category}`;
}

export async function getPartnerAccess(userId: string): Promise<PartnerAccessRow | null> {
  if (!isDatabaseEnabled()) return null;
  const sql = await getSql();
  const rows = await sql<PartnerAccessRow[]>`
    select
      p.status,
      p.can_create_partners,
      p.uses_custom_menu_permissions,
      coalesce(
        (select array_agg(m.menu_id order by m.menu_id)
         from crm.user_menu_permissions m where m.user_id = p.user_id),
        '{}'
      ) as menu_ids
    from crm.partner_profiles p
    where p.user_id = ${userId}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function partnerTaxIdExists(taxId: string, exceptUserId?: string): Promise<boolean> {
  requireDatabase();
  const sql = await getSql();
  const rows = await sql<{ exists: boolean }[]>`
    select exists (
      select 1
      from crm.partner_profiles
      where tax_id = ${taxId}
        and (${exceptUserId ?? null}::text is null or user_id <> ${exceptUserId ?? null})
    ) as exists
  `;
  return rows[0]?.exists ?? false;
}

export async function listPartnersForActor(
  actorUserId: string,
  isMaster: boolean,
  query: PartnerListQuery,
): Promise<PartnerListResult> {
  requireDatabase();
  const sql = await getSql();
  const search = query.search.trim();
  const searchPattern = search ? `%${search}%` : null;
  const offset = (query.page - 1) * query.pageSize;

  const productionClause =
    query.production === "with"
      ? sql`and p.has_production = true`
      : query.production === "without"
        ? sql`and p.has_production = false`
        : sql``;
  const bankClause =
    query.bankIds.length > 0
      ? sql`and exists (
          select 1 from crm.partner_banks filter_bank
          where filter_bank.partner_user_id = p.user_id
            and filter_bank.bank_id in ${sql(query.bankIds)}
        )`
      : sql``;
  const searchClause = searchPattern
    ? sql`and (
        u.name ilike ${searchPattern}
        or u.email ilike ${searchPattern}
        or coalesce(p.tax_id, '') ilike ${searchPattern}
        or p.phone ilike ${searchPattern}
        or p.whatsapp ilike ${searchPattern}
      )`
    : sql``;

  const visibilitySeed = isMaster
    ? sql`select p.user_id from crm.partner_profiles p where p.user_id <> ${actorUserId}`
    : sql`select p.user_id from crm.partner_profiles p where p.parent_user_id = ${actorUserId}`;
  const visibilityRecursion = isMaster
    ? sql``
    : sql`
        union all
        select child.user_id
        from crm.partner_profiles child
        inner join visible parent on parent.user_id = child.parent_user_id
      `;

  const [items, totalRows, countRows, access] = await Promise.all([
    sql<PartnerRow[]>`
      with recursive visible(user_id) as (
        ${visibilitySeed}
        ${visibilityRecursion}
      )
      select
        p.user_id,
        p.parent_user_id,
        parent_user.name as parent_name,
        u.name,
        u.email,
        p.partner_category,
        p.person_type,
        p.tax_id,
        p.rg,
        p.phone,
        p.whatsapp,
        p.pix_key_type,
        p.pix_key,
        p.cep,
        p.street,
        p.neighborhood,
        p.city,
        p.state,
        p.complement,
        p.number,
        p.status,
        p.blocked_reason,
        exists (
          select 1 from crm.partner_events blocked_event
          where blocked_event.partner_user_id = p.user_id
            and blocked_event.action = 'blocked'
        ) as has_block_history,
        p.can_create_partners,
        p.has_production,
        coalesce(
          (select array_agg(m.menu_id order by m.menu_id)
           from crm.user_menu_permissions m where m.user_id = p.user_id),
          '{}'
        ) as menu_ids,
        coalesce(
          (select array_agg(b.bank_id order by b.bank_id)
           from crm.partner_banks b where b.partner_user_id = p.user_id),
          '{}'
        ) as bank_ids,
        p.created_at,
        p.updated_at
      from visible v
      inner join crm.partner_profiles p on p.user_id = v.user_id
      inner join crm.users u on u.id = p.user_id
      left join crm.users parent_user on parent_user.id = p.parent_user_id
      where p.status = ${query.status}
        ${productionClause}
        ${bankClause}
        ${searchClause}
      order by p.created_at desc, u.name
      limit ${query.pageSize}
      offset ${offset}
    `,
    sql<{ total: number }[]>`
      with recursive visible(user_id) as (
        ${visibilitySeed}
        ${visibilityRecursion}
      )
      select count(*)::int as total
      from visible v
      inner join crm.partner_profiles p on p.user_id = v.user_id
      inner join crm.users u on u.id = p.user_id
      where p.status = ${query.status}
        ${productionClause}
        ${bankClause}
        ${searchClause}
    `,
    sql<{ status: PartnerStatus; total: number }[]>`
      with recursive visible(user_id) as (
        ${visibilitySeed}
        ${visibilityRecursion}
      )
      select p.status, count(*)::int as total
      from visible v
      inner join crm.partner_profiles p on p.user_id = v.user_id
      group by p.status
    `,
    getPartnerAccess(actorUserId),
  ]);

  const counts: Record<PartnerStatus, number> = { active: 0, inactive: 0, blocked: 0 };
  for (const row of countRows) counts[row.status] = row.total;

  return {
    items: items.map(mapPartner),
    total: totalRows[0]?.total ?? 0,
    page: query.page,
    pageSize: query.pageSize,
    counts,
    canCreatePartners: isMaster || Boolean(access?.can_create_partners),
    allowedMenuIds: isMaster ? [...ALL_MENU_ITEM_IDS] : ((access?.menu_ids ?? []) as MenuItemId[]),
  };
}

export async function findVisiblePartner(
  actorUserId: string,
  isMaster: boolean,
  targetUserId: string,
): Promise<PartnerRecord | null> {
  requireDatabase();
  const sql = await getSql();
  const seed = isMaster
    ? sql`select p.user_id from crm.partner_profiles p where p.user_id <> ${actorUserId}`
    : sql`select p.user_id from crm.partner_profiles p where p.parent_user_id = ${actorUserId}`;
  const recursion = isMaster
    ? sql``
    : sql`
        union all
        select child.user_id
        from crm.partner_profiles child
        inner join visible parent on parent.user_id = child.parent_user_id
      `;

  const rows = await sql<PartnerRow[]>`
    with recursive visible(user_id) as (
      ${seed}
      ${recursion}
    )
    select
      p.user_id, p.parent_user_id, parent_user.name as parent_name, u.name, u.email,
      p.partner_category, p.person_type, p.tax_id, p.rg, p.phone, p.whatsapp,
      p.pix_key_type, p.pix_key, p.cep, p.street, p.neighborhood, p.city, p.state,
      p.complement, p.number, p.status, p.blocked_reason,
      exists (
        select 1 from crm.partner_events blocked_event
        where blocked_event.partner_user_id = p.user_id
          and blocked_event.action = 'blocked'
      ) as has_block_history,
      p.can_create_partners,
      p.has_production,
      coalesce((select array_agg(m.menu_id order by m.menu_id)
                from crm.user_menu_permissions m where m.user_id = p.user_id), '{}') as menu_ids,
      coalesce((select array_agg(b.bank_id order by b.bank_id)
                from crm.partner_banks b where b.partner_user_id = p.user_id), '{}') as bank_ids,
      p.created_at, p.updated_at
    from visible v
    inner join crm.partner_profiles p on p.user_id = v.user_id
    inner join crm.users u on u.id = p.user_id
    left join crm.users parent_user on parent_user.id = p.parent_user_id
    where p.user_id = ${targetUserId}
    limit 1
  `;
  return rows[0] ? mapPartner(rows[0]) : null;
}

export async function insertPartner(input: {
  userId: string;
  actorUserId: string;
  actorName: string;
  passwordSaltB64: string;
  passwordHashB64: string;
  data: PartnerUpsertInput;
}): Promise<void> {
  requireDatabase();
  const sql = await getSql();
  const now = new Date().toISOString();
  await sql.begin(async (tx) => {
    await tx`
      insert into crm.users (
        id, email, name, category_id, role, password_salt_b64, password_hash_b64,
        created_at, updated_at
      ) values (
        ${input.userId},
        ${input.data.email},
        ${input.data.name},
        ${categoryIdForPartner(input.data.category)},
        'user',
        ${input.passwordSaltB64},
        ${input.passwordHashB64},
        ${now},
        ${now}
      )
    `;
    await tx`
      insert into crm.partner_profiles (
        user_id, parent_user_id, partner_category, person_type, tax_id, rg,
        phone, whatsapp, pix_key_type, pix_key, cep, street, neighborhood,
        city, state, complement, number, status, can_create_partners,
        uses_custom_menu_permissions, created_by_user_id, created_at, updated_at
      ) values (
        ${input.userId}, ${input.actorUserId}, ${input.data.category},
        ${input.data.personType}, ${input.data.taxId}, ${input.data.rg},
        ${input.data.phone}, ${input.data.whatsapp}, ${input.data.pixKeyType},
        ${input.data.pixKey}, ${input.data.cep}, ${input.data.street},
        ${input.data.neighborhood}, ${input.data.city}, ${input.data.state},
        ${input.data.complement}, ${input.data.number}, 'active',
        ${input.data.canCreatePartners}, true, ${input.actorUserId}, ${now}, ${now}
      )
    `;
    if (input.data.menuIds.length > 0) {
      await tx`
        insert into crm.user_menu_permissions ${tx(
          input.data.menuIds.map((menuId) => ({ user_id: input.userId, menu_id: menuId })),
          "user_id",
          "menu_id",
        )}
      `;
    }
    if (input.data.bankIds.length > 0) {
      await tx`
        insert into crm.partner_banks ${tx(
          input.data.bankIds.map((bankId) => ({
            partner_user_id: input.userId,
            bank_id: bankId,
          })),
          "partner_user_id",
          "bank_id",
        )}
      `;
    }
    await tx`
      insert into crm.partner_events (
        id, partner_user_id, actor_user_id, actor_name, action, created_at
      ) values (
        ${`partner-event-${crypto.randomUUID()}`},
        ${input.userId},
        ${input.actorUserId},
        ${input.actorName},
        'created',
        ${now}
      )
    `;
  });
}

export async function updatePartner(input: {
  targetUserId: string;
  actorUserId: string;
  actorName: string;
  passwordSaltB64?: string;
  passwordHashB64?: string;
  data: PartnerUpsertInput;
}): Promise<void> {
  requireDatabase();
  const sql = await getSql();
  await sql.begin(async (tx) => {
    await tx`
      update crm.users
      set name = ${input.data.name},
          email = ${input.data.email},
          category_id = ${categoryIdForPartner(input.data.category)},
          password_salt_b64 = coalesce(${input.passwordSaltB64 ?? null}, password_salt_b64),
          password_hash_b64 = coalesce(${input.passwordHashB64 ?? null}, password_hash_b64),
          updated_at = now()
      where id = ${input.targetUserId}
    `;
    await tx`
      update crm.partner_profiles
      set partner_category = ${input.data.category},
          person_type = ${input.data.personType},
          tax_id = ${input.data.taxId},
          rg = ${input.data.rg},
          phone = ${input.data.phone},
          whatsapp = ${input.data.whatsapp},
          pix_key_type = ${input.data.pixKeyType},
          pix_key = ${input.data.pixKey},
          cep = ${input.data.cep},
          street = ${input.data.street},
          neighborhood = ${input.data.neighborhood},
          city = ${input.data.city},
          state = ${input.data.state},
          complement = ${input.data.complement},
          number = ${input.data.number},
          can_create_partners = ${input.data.canCreatePartners},
          uses_custom_menu_permissions = true,
          updated_at = now()
      where user_id = ${input.targetUserId}
    `;
    await tx`delete from crm.user_menu_permissions where user_id = ${input.targetUserId}`;
    if (input.data.menuIds.length > 0) {
      await tx`
        insert into crm.user_menu_permissions ${tx(
          input.data.menuIds.map((menuId) => ({
            user_id: input.targetUserId,
            menu_id: menuId,
          })),
          "user_id",
          "menu_id",
        )}
      `;
    }
    await tx`delete from crm.partner_banks where partner_user_id = ${input.targetUserId}`;
    if (input.data.bankIds.length > 0) {
      await tx`
        insert into crm.partner_banks ${tx(
          input.data.bankIds.map((bankId) => ({
            partner_user_id: input.targetUserId,
            bank_id: bankId,
          })),
          "partner_user_id",
          "bank_id",
        )}
      `;
    }
    await tx`
      insert into crm.partner_events (
        id, partner_user_id, actor_user_id, actor_name, action
      ) values (
        ${`partner-event-${crypto.randomUUID()}`},
        ${input.targetUserId},
        ${input.actorUserId},
        ${input.actorName},
        'updated'
      )
    `;
  });
}

export async function changePartnerStatus(input: {
  targetUserId: string;
  actorUserId: string;
  actorName: string;
  status: PartnerStatus;
  reason?: string;
  action: PartnerEventAction;
}): Promise<void> {
  requireDatabase();
  const sql = await getSql();
  const blocked = input.status === "blocked";
  await sql.begin(async (tx) => {
    const rows = await tx<{ user_id: string }[]>`
      update crm.partner_profiles
      set status = ${input.status},
          blocked_reason = ${blocked ? input.reason?.trim() || null : null},
          blocked_at = ${blocked ? new Date().toISOString() : null},
          blocked_by_user_id = ${blocked ? input.actorUserId : null},
          updated_at = now()
      where user_id = ${input.targetUserId}
      returning user_id
    `;
    if (!rows[0]) throw new Error("Parceiro não encontrado.");
    await tx`
      insert into crm.partner_events (
        id, partner_user_id, actor_user_id, actor_name, action, reason
      ) values (
        ${`partner-event-${crypto.randomUUID()}`},
        ${input.targetUserId},
        ${input.actorUserId},
        ${input.actorName},
        ${input.action},
        ${input.reason?.trim() || null}
      )
    `;
  });
}

export async function listPartnerEvents(partnerUserId: string): Promise<PartnerEventRecord[]> {
  requireDatabase();
  const sql = await getSql();
  const rows = await sql<
    {
      id: string;
      action: PartnerEventAction;
      actor_name: string;
      reason: string | null;
      created_at: Date;
    }[]
  >`
    select id, action, actor_name, reason, created_at
    from crm.partner_events
    where partner_user_id = ${partnerUserId}
    order by created_at desc
    limit 100
  `;
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    actorName: row.actor_name,
    reason: row.reason,
    createdAt: row.created_at.toISOString(),
  }));
}
