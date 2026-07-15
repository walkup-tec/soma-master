import type { Sql } from "@/lib/db/postgres";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/config/settings-defaults";
import { MASTER_USER } from "@/lib/auth/master-user";
import { normalizeProductFields } from "@/lib/config/settings-defaults";

export async function ensureDatabaseSeeded(sql: Sql): Promise<void> {
  const [{ count }] = await sql<{ count: string }[]>`
    select count(*)::text as count from crm.users
  `;
  if (Number(count) > 0) return;

  const settings = DEFAULT_SYSTEM_SETTINGS;

  await sql`
    alter table crm.user_categories
    add column if not exists home_menu_id text not null default 'dashboard'
  `;

  await sql.begin(async (tx) => {
    for (const category of settings.categories) {
      await tx`
        insert into crm.user_categories (id, name, home_menu_id)
        values (${category.id}, ${category.name}, ${category.homeMenuId})
        on conflict (id) do nothing
      `;
      for (const menuId of category.menuIds) {
        await tx`
          insert into crm.user_category_menus (category_id, menu_id)
          values (${category.id}, ${menuId})
          on conflict do nothing
        `;
      }
    }

    for (const product of settings.products.map((item) => normalizeProductFields(item))) {
      await tx`
        insert into crm.products (id, name)
        values (${product.id}, ${product.name})
        on conflict (id) do nothing
      `;
      if (product.requiredFieldIds.length === 0) continue;
      const requiredRows = product.requiredFieldIds.map((fieldId) => ({
        product_id: product.id,
        field_id: fieldId,
        required: true,
      }));
      await tx`
        insert into crm.product_fields ${tx(requiredRows, "product_id", "field_id", "required")}
        on conflict do nothing
      `;
    }

    await tx`
      insert into crm.users (
        id, email, name, category_id, role, password_salt_b64, password_hash_b64, created_at
      ) values (
        ${MASTER_USER.id},
        ${MASTER_USER.email},
        ${MASTER_USER.name},
        ${MASTER_USER.categoryId},
        ${MASTER_USER.role},
        ${MASTER_USER.passwordSaltB64},
        ${MASTER_USER.passwordHashB64},
        ${MASTER_USER.createdAt}
      )
      on conflict (id) do nothing
    `;
  });
}
