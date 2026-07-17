import { ALL_CLIENT_FIELD_IDS, LEGACY_CLIENT_FIELD_IDS, type ClientFieldId } from "@/lib/config/client-fields";
import { ALL_MENU_ITEM_IDS, type MenuItemId } from "@/lib/config/menu-items";
import { resolveCategoryHomeMenuId } from "@/lib/config/category-utils";
import type {
  AttendanceStatusConfig,
  BankConfig,
  SystemSettings,
  UserCategory,
} from "@/lib/config/settings-types";
import { DEFAULT_STATUS_COLOR, normalizeStatusColor } from "@/lib/config/status-colors";

const masterCategoryId = "cat-master";
const atendenteCategoryId = "cat-atendente";
const gerenteCategoryId = "cat-gerente";

export const DEFAULT_ATTENDANCE_STATUSES: AttendanceStatusConfig[] = [
  { id: "novo", label: "Novo", color: "#3b82f6", autoReturnDays: null },
  { id: "em_atendimento", label: "Em atendimento", color: "#f59e0b", autoReturnDays: null },
  { id: "aguardando_retorno", label: "Aguardando retorno", color: "#8b5cf6", autoReturnDays: 3 },
  { id: "concluido", label: "Concluído", color: "#22c55e", autoReturnDays: null },
  { id: "perdido", label: "Perdido", color: "#ef4444", autoReturnDays: null },
];

export const AUTO_RETURN_DAYS_OPTIONS = [1, 2, 3, 5, 7, 10, 14, 15, 21, 30, 45, 60] as const;
export const MAX_AUTO_RETURN_DAYS = 90;

export function normalizeAutoReturnDays(value: unknown): number | null {
  if (value == null || value === "" || value === 0 || value === "0") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  const days = Math.floor(n);
  if (days < 1 || days > MAX_AUTO_RETURN_DAYS) return null;
  return days;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  categories: [
    {
      id: masterCategoryId,
      name: "Master",
      menuIds: [...ALL_MENU_ITEM_IDS],
      homeMenuId: "dashboard",
    },
    {
      id: atendenteCategoryId,
      name: "Atendente",
      menuIds: ["dashboard", "clientes", "kanban", "agenda"],
      homeMenuId: "dashboard",
    },
    {
      id: gerenteCategoryId,
      name: "Gerente",
      menuIds: ["dashboard", "clientes", "kanban", "agenda", "configuracoes"],
      homeMenuId: "dashboard",
    },
  ],
  products: [
    {
      id: "prod-clt",
      name: "Empréstimo CLT",
      tag: "CLT",
      color: "#be1c6a",
      availableFieldIds: [],
      requiredFieldIds: ["nome", "cpf", "telefone", "tipo_cliente", "renda_mensal"],
    },
    {
      id: "prod-fgts",
      name: "Antecipação FGTS",
      tag: "FGTS",
      color: "#0d9488",
      availableFieldIds: [],
      requiredFieldIds: ["nome", "cpf", "telefone"],
    },
  ],
  banks: [],
  attendanceStatuses: [...DEFAULT_ATTENDANCE_STATUSES],
};

export function createEmptyProduct(): import("@/lib/config/settings-types").ProductConfig {
  return normalizeProductFields({
    id: `prod-${crypto.randomUUID().slice(0, 8)}`,
    name: "",
    tag: "",
    color: DEFAULT_STATUS_COLOR,
    availableFieldIds: [...ALL_CLIENT_FIELD_IDS],
    requiredFieldIds: [],
  });
}

export function createEmptyBank(): BankConfig {
  return {
    id: `bank-${crypto.randomUUID().slice(0, 8)}`,
    name: "",
  };
}

export function createEmptyCategory(): UserCategory {
  const menuIds: MenuItemId[] = ["dashboard", "clientes", "kanban"];
  return {
    id: `cat-${crypto.randomUUID().slice(0, 8)}`,
    name: "",
    menuIds,
    homeMenuId: resolveCategoryHomeMenuId(menuIds, "dashboard"),
  };
}

function migrateCategory(raw: Record<string, unknown>): UserCategory {
  const menuIds = Array.isArray(raw.menuIds)
    ? (raw.menuIds as MenuItemId[])
    : (["dashboard", "clientes", "kanban"] as MenuItemId[]);
  const preferred =
    typeof raw.homeMenuId === "string" && raw.homeMenuId
      ? (raw.homeMenuId as MenuItemId)
      : null;
  return {
    id: String(raw.id ?? `cat-${crypto.randomUUID().slice(0, 8)}`),
    name: String(raw.name ?? ""),
    menuIds,
    homeMenuId: resolveCategoryHomeMenuId(menuIds, preferred),
  };
}

/**
 * Categorias com Clientes passam a ter Kanban (módulo irmão).
 * Mantém a ordem do menu: após `clientes` quando possível.
 */
export function ensureKanbanMenuForClientCategories(menuIds: MenuItemId[]): MenuItemId[] {
  if (!menuIds.includes("clientes") || menuIds.includes("kanban")) return menuIds;
  const next = [...menuIds];
  const clientesIndex = next.indexOf("clientes");
  if (clientesIndex >= 0) {
    next.splice(clientesIndex + 1, 0, "kanban");
    return next;
  }
  next.push("kanban");
  return next;
}

/** Garante campos válidos (todos disponíveis por padrão, exceto os obrigatórios) e categorias válidas. */
export function normalizeSettings(settings: SystemSettings & { defaultCategoryId?: string }): SystemSettings {
  const rawCategories =
    settings.categories.length > 0
      ? settings.categories.map((c) => migrateCategory(c as unknown as Record<string, unknown>))
      : DEFAULT_SYSTEM_SETTINGS.categories;

  const validMenuIds = new Set(ALL_MENU_ITEM_IDS);
  const categories = rawCategories.map((c) => {
    const menuIds = ensureKanbanMenuForClientCategories(
      c.menuIds.filter((id): id is MenuItemId => validMenuIds.has(id as MenuItemId)),
    );
    return {
      ...c,
      menuIds,
      homeMenuId: resolveCategoryHomeMenuId(menuIds, c.homeMenuId),
    };
  });

  const products = settings.products.map((p) => normalizeProductFields(p));
  const banks = normalizeBanks(settings.banks ?? []);
  const attendanceStatuses = normalizeAttendanceStatuses(settings.attendanceStatuses ?? []);

  return { categories, products, banks, attendanceStatuses };
}

export function createEmptyAttendanceStatus(): AttendanceStatusConfig {
  return {
    id: `status-${crypto.randomUUID().slice(0, 8)}`,
    label: "",
    color: DEFAULT_STATUS_COLOR,
    autoReturnDays: null,
  };
}

export function normalizeAttendanceStatuses(
  statuses: AttendanceStatusConfig[],
): AttendanceStatusConfig[] {
  const defaultById = new Map(DEFAULT_ATTENDANCE_STATUSES.map((status) => [status.id, status]));
  const seen = new Set<string>();
  const normalized = statuses
    .map((status) => {
      const id = String(status.id ?? `status-${crypto.randomUUID().slice(0, 8)}`).trim();
      const fallback = defaultById.get(id)?.color ?? DEFAULT_STATUS_COLOR;
      const defaultDays = defaultById.get(id)?.autoReturnDays ?? null;
      const rawDays = (status as { autoReturnDays?: unknown }).autoReturnDays;
      return {
        id,
        label: String(status.label ?? "").trim(),
        color: normalizeStatusColor(status.color, fallback),
        autoReturnDays:
          rawDays === undefined ? defaultDays : normalizeAutoReturnDays(rawDays),
      };
    })
    .filter((status) => {
      if (!status.id || !status.label) return false;
      if (seen.has(status.id)) return false;
      seen.add(status.id);
      return true;
    });

  return normalized.length > 0 ? normalized : [...DEFAULT_ATTENDANCE_STATUSES];
}

export function normalizeBanks(banks: BankConfig[]): BankConfig[] {
  const seen = new Set<string>();
  return banks
    .map((bank) => ({
      id: String(bank.id ?? `bank-${crypto.randomUUID().slice(0, 8)}`),
      name: String(bank.name ?? "").trim(),
    }))
    .filter((bank) => {
      if (!bank.name) return false;
      const key = bank.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function migrateClientFieldId(id: string): ClientFieldId | null {
  if (ALL_CLIENT_FIELD_IDS.includes(id as ClientFieldId)) return id as ClientFieldId;
  const legacy = LEGACY_CLIENT_FIELD_IDS[id];
  if (legacy === undefined) return null;
  return legacy;
}

function migrateFieldIdList(ids: string[]): ClientFieldId[] {
  const result: ClientFieldId[] = [];
  const seen = new Set<ClientFieldId>();
  for (const id of ids) {
    const migrated = migrateClientFieldId(id);
    if (!migrated || seen.has(migrated)) continue;
    seen.add(migrated);
    result.push(migrated);
  }
  return result;
}

export function normalizeProductFields(
  product: import("@/lib/config/settings-types").ProductConfig,
): import("@/lib/config/settings-types").ProductConfig {
  const requiredFieldIds = migrateFieldIdList(product.requiredFieldIds);
  const requiredSet = new Set(requiredFieldIds);
  const availableFieldIds = ALL_CLIENT_FIELD_IDS.filter((id) => !requiredSet.has(id));
  const name = String(product.name ?? "").trim();
  const tag = String(product.tag ?? "").trim();
  return {
    ...product,
    name,
    tag,
    color: normalizeStatusColor(product.color, DEFAULT_STATUS_COLOR),
    availableFieldIds,
    requiredFieldIds,
  };
}

/** Texto exibido na tag colorida (tag curta ou nome completo). */
export function resolveProductTagLabel(
  product: Pick<import("@/lib/config/settings-types").ProductConfig, "name" | "tag">,
): string {
  return product.tag.trim() || product.name.trim() || "Produto";
}
