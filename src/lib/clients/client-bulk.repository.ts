import type {
  ClientBulkFilters,
  ClientBulkScope,
  ClientsPageQuery,
} from "@/lib/clients/client.types";
import { saveClientSchedule } from "@/lib/clients/client-schedule.repository";
import { findUserById } from "@/lib/users/user.repository";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";
import type { Sql } from "@/lib/db/postgres";

const MAX_BULK = 5000;

type NormalizedBulkFilters = {
  search: string;
  productIds: string[];
  statuses: string[];
  attendance: NonNullable<ClientBulkFilters["attendance"]>;
  schedule: NonNullable<ClientBulkFilters["schedule"]>;
  createdFrom: string;
  createdTo: string;
};

function normalizeIdList(...sources: unknown[]): string[] {
  const values: string[] = [];
  for (const source of sources) {
    if (Array.isArray(source)) {
      for (const item of source) {
        if (typeof item === "string" && item.trim()) values.push(item.trim());
      }
    } else if (typeof source === "string" && source.trim()) {
      values.push(source.trim());
    }
  }
  return [...new Set(values)];
}

function normalizeBulkFilters(filters: ClientBulkFilters = {}): NormalizedBulkFilters {
  let createdFrom =
    typeof filters.createdFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(filters.createdFrom.trim())
      ? filters.createdFrom.trim()
      : "";
  let createdTo =
    typeof filters.createdTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(filters.createdTo.trim())
      ? filters.createdTo.trim()
      : "";
  if (createdFrom && createdTo && createdFrom > createdTo) {
    const swap = createdFrom;
    createdFrom = createdTo;
    createdTo = swap;
  }
  return {
    search: typeof filters.search === "string" ? filters.search.trim().slice(0, 100) : "",
    productIds: normalizeIdList(filters.productIds, filters.productId),
    statuses: normalizeIdList(filters.statuses, filters.status),
    attendance:
      filters.attendance === "with" || filters.attendance === "without" ? filters.attendance : "all",
    schedule: filters.schedule === "with" ? "with" : "all",
    createdFrom,
    createdTo,
  };
}

export function buildBulkWhereClause(
  sql: Sql,
  filters: NormalizedBulkFilters,
  searchPattern: string | null,
) {
  const hasSearch = Boolean(searchPattern);
  const hasProduct = filters.productIds.length > 0;
  const hasStatus = filters.statuses.length > 0;
  const hasCreatedFrom = Boolean(filters.createdFrom);
  const hasCreatedTo = Boolean(filters.createdTo);

  return sql`
    where true
    ${
      hasSearch
        ? sql`and (
            coalesce(c.data->>'nome', '') ilike ${searchPattern}
            or coalesce(c.data->>'cpf', '') ilike ${searchPattern}
            or coalesce(c.data->>'telefone', '') ilike ${searchPattern}
          )`
        : sql``
    }
    ${
      hasProduct
        ? sql`and (
            c.product_id = any(${filters.productIds})
            or exists (
              select 1 from crm.client_products cp
              where cp.client_id = c.id and cp.product_id = any(${filters.productIds})
            )
          )`
        : sql``
    }
    ${hasStatus ? sql`and c.status = any(${filters.statuses})` : sql``}
    ${
      filters.attendance === "with"
        ? sql`and exists (select 1 from crm.client_attendances att where att.client_id = c.id)`
        : sql``
    }
    ${
      filters.attendance === "without"
        ? sql`and not exists (select 1 from crm.client_attendances att where att.client_id = c.id)`
        : sql``
    }
    ${
      filters.schedule === "with"
        ? sql`and exists (select 1 from crm.client_schedules sch where sch.client_id = c.id)`
        : sql``
    }
    ${
      hasCreatedFrom
        ? sql`and ((c.created_at at time zone 'America/Sao_Paulo')::date >= ${filters.createdFrom}::date)`
        : sql``
    }
    ${
      hasCreatedTo
        ? sql`and ((c.created_at at time zone 'America/Sao_Paulo')::date <= ${filters.createdTo}::date)`
        : sql``
    }
  `;
}

async function resolveClientIdsFromScope(
  scope: ClientBulkScope,
  userId: string,
  isMaster: boolean,
): Promise<string[]> {
  if (scope.mode === "ids") {
    const ids = [...new Set(scope.clientIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) throw new Error("Nenhum cliente selecionado.");
    if (ids.length > MAX_BULK) {
      throw new Error(`Selecione no máximo ${MAX_BULK.toLocaleString("pt-BR")} clientes por vez.`);
    }

    if (!isDatabaseEnabled()) {
      return ids;
    }

    const sql = await getSql();
    if (isMaster) {
      const rows = await sql<{ id: string }[]>`
        select id from crm.clients where id in ${sql(ids)}
      `;
      return rows.map((row) => row.id);
    }

    const rows = await sql<{ id: string }[]>`
      select c.id
      from crm.clients c
      inner join crm.client_assignments mine on mine.client_id = c.id and mine.user_id = ${userId}
      where c.id in ${sql(ids)}
    `;
    return rows.map((row) => row.id);
  }

  const filters = normalizeBulkFilters(scope.filters);
  if (!isDatabaseEnabled()) {
    throw new Error("Seleção por filtro exige banco de dados ativo.");
  }

  const sql = await getSql();
  const searchPattern = filters.search ? `%${filters.search}%` : null;
  const assignmentJoin = isMaster
    ? sql``
    : sql`inner join crm.client_assignments mine on mine.client_id = c.id and mine.user_id = ${userId}`;
  const whereClause = buildBulkWhereClause(sql, filters, searchPattern);

  const rows = await sql<{ id: string }[]>`
    select c.id
    from crm.clients c
    ${assignmentJoin}
    ${whereClause}
    order by c.created_at desc
    limit ${MAX_BULK + 1}
  `;

  if (rows.length > MAX_BULK) {
    throw new Error(
      `O filtro retornou mais de ${MAX_BULK.toLocaleString("pt-BR")} clientes. Refine o filtro antes da ação em lote.`,
    );
  }
  if (rows.length === 0) throw new Error("Nenhum cliente no filtro atual.");
  return rows.map((row) => row.id);
}

export async function countClientsInBulkScope(
  scope: ClientBulkScope,
  userId: string,
  isMaster: boolean,
): Promise<number> {
  if (scope.mode === "ids") return resolveClientIdsFromScope(scope, userId, isMaster).then((ids) => ids.length);

  const filters = normalizeBulkFilters(scope.filters);
  if (!isDatabaseEnabled()) return 0;
  const sql = await getSql();
  const searchPattern = filters.search ? `%${filters.search}%` : null;
  const assignmentJoin = isMaster
    ? sql``
    : sql`inner join crm.client_assignments mine on mine.client_id = c.id and mine.user_id = ${userId}`;
  const whereClause = buildBulkWhereClause(sql, filters, searchPattern);
  const rows = await sql<{ total: number }[]>`
    select count(*)::int as total
    from crm.clients c
    ${assignmentJoin}
    ${whereClause}
  `;
  return rows[0]?.total ?? 0;
}

export async function bulkScheduleClientsForUser(input: {
  scope: ClientBulkScope;
  actorUserId: string;
  isMaster: boolean;
  targetUserId: string;
  contactDate: string;
}): Promise<{ affected: number }> {
  const target = await findUserById(input.targetUserId);
  if (!target) throw new Error("Usuário de destino não encontrado.");

  const clientIds = await resolveClientIdsFromScope(input.scope, input.actorUserId, input.isMaster);
  const sql = isDatabaseEnabled() ? await getSql() : null;

  for (const clientId of clientIds) {
    await saveClientSchedule({
      clientId,
      contactDate: input.contactDate,
      userId: target.id,
      userName: target.name,
    });

    if (sql) {
      await sql`
        insert into crm.client_assignments (client_id, user_id)
        values (${clientId}, ${target.id})
        on conflict do nothing
      `;
    }
  }

  return { affected: clientIds.length };
}

export async function bulkAddProductToClients(input: {
  scope: ClientBulkScope;
  actorUserId: string;
  isMaster: boolean;
  productId: string;
}): Promise<{ affected: number }> {
  const productId = input.productId.trim();
  if (!productId) throw new Error("Selecione um produto.");

  const clientIds = await resolveClientIdsFromScope(input.scope, input.actorUserId, input.isMaster);
  if (!isDatabaseEnabled()) {
    throw new Error("Adicionar produto em lote exige banco de dados ativo.");
  }

  const sql = await getSql();
  const productRows = await sql<{ id: string }[]>`
    select id from crm.products where id = ${productId} limit 1
  `;
  if (!productRows[0]) throw new Error("Produto não encontrado.");

  // Garante primary + novo produto sem duplicar o cadastro do cliente.
  await sql`
    insert into crm.client_products (client_id, product_id)
    select c.id, c.product_id
    from crm.clients c
    where c.id in ${sql(clientIds)}
    on conflict do nothing
  `;

  const extraRows = clientIds.map((clientId) => ({
    client_id: clientId,
    product_id: productId,
  }));
  await sql`
    insert into crm.client_products ${sql(extraRows)}
    on conflict do nothing
  `;

  return { affected: clientIds.length };
}

export async function bulkDeleteClients(input: {
  scope: ClientBulkScope;
  actorUserId: string;
  isMaster: boolean;
}): Promise<{ affected: number }> {
  if (!input.isMaster) {
    throw new Error("Apenas usuários master podem excluir clientes em lote.");
  }

  const clientIds = await resolveClientIdsFromScope(input.scope, input.actorUserId, input.isMaster);
  if (!isDatabaseEnabled()) {
    throw new Error("Exclusão em lote exige banco de dados ativo.");
  }

  const sql = await getSql();
  const deleted = await sql<{ id: string }[]>`
    delete from crm.clients
    where id in ${sql(clientIds)}
    returning id
  `;
  return { affected: deleted.length };
}

export async function bulkUpdateClientStatus(input: {
  scope: ClientBulkScope;
  actorUserId: string;
  isMaster: boolean;
  status: string;
}): Promise<{ affected: number; clientIds: string[] }> {
  const status = input.status.trim();
  if (!status) throw new Error("Status inválido.");

  const clientIds = await resolveClientIdsFromScope(input.scope, input.actorUserId, input.isMaster);
  if (!isDatabaseEnabled()) {
    throw new Error("Alterar status em lote exige banco de dados ativo.");
  }

  const sql = await getSql();
  const updated = await sql<{ id: string }[]>`
    update crm.clients
    set status = ${status}
    where id in ${sql(clientIds)}
    returning id
  `;
  return { affected: updated.length, clientIds: updated.map((row) => row.id) };
}

export function filtersFromClientsPageQuery(query: ClientsPageQuery): ClientBulkFilters {
  return {
    search: query.search,
    productIds: query.productIds,
    productId: query.productId,
    statuses: query.statuses,
    status: query.status,
    attendance: query.attendance,
    schedule: query.schedule,
    createdFrom: query.createdFrom,
    createdTo: query.createdTo,
  };
}
