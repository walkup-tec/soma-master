import {
  ALL_CLIENT_FIELD_IDS,
  LEGACY_CLIENT_FIELD_IDS,
  isCustomClientFieldId,
  type ClientFieldId,
  type ClientFieldGroupId,
} from "@/lib/config/client-fields";
import { ALL_MENU_ITEM_IDS, type MenuItemId } from "@/lib/config/menu-items";
import { resolveCategoryHomeMenuId } from "@/lib/config/category-utils";
import type {
  AttendanceStatusConfig,
  BankConfig,
  ChatbotDaySchedule,
  ChatbotRuntimeConfig,
  ChatTagConfig,
  ProductCustomField,
  ProductOperationalGuide,
  SystemSettings,
  UserCategory,
  WeekdayId,
} from "@/lib/config/settings-types";
import { DEFAULT_STATUS_COLOR, normalizeStatusColor } from "@/lib/config/status-colors";
import { isPartnerLinkedUserCategoryId } from "@/lib/partners/partner.constants";

const masterCategoryId = "cat-master";
const atendenteCategoryId = "cat-atendente";
const gerenteCategoryId = "cat-gerente";

export const WEEKDAY_ORDER: WeekdayId[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const WEEKDAY_LABELS: Record<WeekdayId, string> = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};

function defaultDay(enabled: boolean, start = "08:00", end = "18:00"): ChatbotDaySchedule {
  return { enabled, start, end };
}

export function createDefaultChatbotRuntime(): ChatbotRuntimeConfig {
  return {
    expedienteBotId: null,
    foraExpedienteBotId: null,
    alwaysOpen: true,
    schedule: {
      mon: defaultDay(true),
      tue: defaultDay(true),
      wed: defaultDay(true),
      thu: defaultDay(true),
      fri: defaultDay(true),
      sat: defaultDay(false),
      sun: defaultDay(false),
    },
  };
}

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
      bankIds: [],
      availableForPartners: false,
      partnerOnly: false,
      availableFieldIds: [],
      requiredFieldIds: ["nome", "cpf", "telefone", "tipo_cliente", "renda_mensal"],
      customFields: [],
      operationalGuideEnabled: false,
      operationalGuide: null,
    },
    {
      id: "prod-fgts",
      name: "Antecipação FGTS",
      tag: "FGTS",
      color: "#0d9488",
      bankIds: [],
      availableForPartners: false,
      partnerOnly: false,
      availableFieldIds: [],
      requiredFieldIds: ["nome", "cpf", "telefone"],
      customFields: [],
      operationalGuideEnabled: false,
      operationalGuide: null,
    },
  ],
  banks: [],
  attendanceStatuses: [...DEFAULT_ATTENDANCE_STATUSES],
  chatTags: [],
  chatbotRuntime: createDefaultChatbotRuntime(),
};

export function createEmptyProduct(options?: {
  partnerOnly?: boolean;
}): import("@/lib/config/settings-types").ProductConfig {
  const partnerOnly = Boolean(options?.partnerOnly);
  return normalizeProductFields({
    id: `prod-${crypto.randomUUID().slice(0, 8)}`,
    name: "",
    tag: "",
    color: DEFAULT_STATUS_COLOR,
    bankIds: [],
    availableForPartners: partnerOnly,
    partnerOnly,
    availableFieldIds: [...ALL_CLIENT_FIELD_IDS],
    requiredFieldIds: [],
    customFields: [],
    operationalGuideEnabled: false,
    operationalGuide: null,
  });
}

export function createEmptyBank(): BankConfig {
  return {
    id: `bank-${crypto.randomUUID().slice(0, 8)}`,
    name: "",
    stormAccessEnabled: false,
    stormUsername: "",
    stormPassword: "",
    stormLink: "",
    bankAccessEnabled: false,
    bankUsername: "",
    bankPassword: "",
    bankLink: "",
    operationalGuideEnabled: false,
    operationalGuide: null,
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
  const categories = rawCategories
    .filter((c) => !isPartnerLinkedUserCategoryId(c.id))
    .map((c) => {
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
  const bankIdSet = new Set(banks.map((bank) => bank.id));
  const productsWithValidBanks = products.map((product) => ({
    ...product,
    bankIds: product.bankIds.filter((id) => bankIdSet.has(id)),
  }));
  const attendanceStatuses = normalizeAttendanceStatuses(settings.attendanceStatuses ?? []);
  const chatTags = normalizeChatTags(settings.chatTags ?? []);
  const chatbotRuntime = normalizeChatbotRuntime(settings.chatbotRuntime);

  return {
    categories,
    products: productsWithValidBanks,
    banks,
    attendanceStatuses,
    chatTags,
    chatbotRuntime,
  };
}

export function createEmptyAttendanceStatus(): AttendanceStatusConfig {
  return {
    id: `status-${crypto.randomUUID().slice(0, 8)}`,
    label: "",
    color: DEFAULT_STATUS_COLOR,
    autoReturnDays: null,
  };
}

export function createEmptyChatTag(): ChatTagConfig {
  return {
    id: `tag-${crypto.randomUUID().slice(0, 8)}`,
    label: "",
    color: DEFAULT_STATUS_COLOR,
    transferBotId: null,
  };
}

function normalizeTimeHm(value: unknown, fallback: string): string {
  const raw = String(value ?? "").trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  return fallback;
}

export function normalizeChatbotRuntime(raw: unknown): ChatbotRuntimeConfig {
  const base = createDefaultChatbotRuntime();
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Partial<ChatbotRuntimeConfig> & {
    schedule?: Partial<Record<WeekdayId, Partial<ChatbotDaySchedule>>>;
    /** Legado: um único bot ativo. */
    activeBotId?: string | null;
  };
  const schedule = { ...base.schedule };
  for (const day of WEEKDAY_ORDER) {
    const src = input.schedule?.[day];
    const fallback = base.schedule[day];
    schedule[day] = {
      enabled: src?.enabled == null ? fallback.enabled : Boolean(src.enabled),
      start: normalizeTimeHm(src?.start, fallback.start),
      end: normalizeTimeHm(src?.end, fallback.end),
    };
  }
  const legacyActive =
    typeof input.activeBotId === "string" && input.activeBotId.trim()
      ? input.activeBotId.trim()
      : null;
  const expedienteBotId =
    typeof input.expedienteBotId === "string" && input.expedienteBotId.trim()
      ? input.expedienteBotId.trim()
      : legacyActive;
  const foraExpedienteBotId =
    typeof input.foraExpedienteBotId === "string" && input.foraExpedienteBotId.trim()
      ? input.foraExpedienteBotId.trim()
      : null;
  return {
    expedienteBotId,
    foraExpedienteBotId,
    alwaysOpen: input.alwaysOpen == null ? true : Boolean(input.alwaysOpen),
    schedule,
  };
}

export function normalizeChatTags(tags: ChatTagConfig[]): ChatTagConfig[] {
  const seen = new Set<string>();
  return tags
    .map((tag) => {
      const transfer =
        typeof tag.transferBotId === "string" && tag.transferBotId.trim()
          ? tag.transferBotId.trim()
          : null;
      return {
        id: String(tag.id ?? `tag-${crypto.randomUUID().slice(0, 8)}`).trim(),
        label: String(tag.label ?? "").trim(),
        color: normalizeStatusColor(tag.color, DEFAULT_STATUS_COLOR),
        transferBotId: transfer,
      };
    })
    .filter((tag) => {
      if (!tag.id || !tag.label) return false;
      if (seen.has(tag.id)) return false;
      seen.add(tag.id);
      return true;
    });
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
    .map((bank) => {
      const guideRaw = bank.operationalGuide;
      const storageId = String(guideRaw?.storageId ?? "").trim();
      const operationalGuide =
        storageId.length > 0
          ? {
              displayName: String(guideRaw?.displayName ?? "").trim(),
              fileName: String(guideRaw?.fileName ?? "").trim(),
              storageId,
            }
          : null;
      return {
        id: String(bank.id ?? `bank-${crypto.randomUUID().slice(0, 8)}`),
        name: String(bank.name ?? "").trim(),
        stormAccessEnabled: Boolean(bank.stormAccessEnabled),
        stormUsername: String(bank.stormUsername ?? "").trim(),
        stormPassword: String(bank.stormPassword ?? ""),
        stormLink: String(bank.stormLink ?? "").trim(),
        bankAccessEnabled: Boolean(bank.bankAccessEnabled),
        bankUsername: String(bank.bankUsername ?? "").trim(),
        bankPassword: String(bank.bankPassword ?? ""),
        bankLink: String(bank.bankLink ?? "").trim(),
        operationalGuideEnabled: Boolean(bank.operationalGuideEnabled),
        operationalGuide,
      };
    })
    .filter((bank) => {
      if (!bank.name) return false;
      const key = bank.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function migrateClientFieldId(id: string): ClientFieldId | null {
  if ((ALL_CLIENT_FIELD_IDS as readonly string[]).includes(id)) return id as ClientFieldId;
  const legacy = LEGACY_CLIENT_FIELD_IDS[id];
  if (legacy === undefined) return null;
  return legacy;
}

const CUSTOM_FIELD_GROUPS = new Set<ClientFieldGroupId>([
  "pessoais",
  "profissionais",
  "financeiros",
]);

function migrateFieldIdList(ids: string[], customIds: Set<string>): ClientFieldId[] {
  const result: ClientFieldId[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const raw = String(id || "").trim();
    if (!raw || seen.has(raw)) continue;
    if (isCustomClientFieldId(raw)) {
      if (!customIds.has(raw)) continue;
      seen.add(raw);
      result.push(raw as `custom-${string}`);
      continue;
    }
    const migrated = migrateClientFieldId(raw);
    if (!migrated || seen.has(migrated)) continue;
    seen.add(migrated);
    result.push(migrated);
  }
  return result;
}

export function normalizeCustomFields(raw: unknown): ProductCustomField[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: ProductCustomField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    const label = String(row.label ?? "").trim();
    const groupId = String(row.groupId ?? "").trim() as ClientFieldGroupId;
    if (!isCustomClientFieldId(id) || !label || !CUSTOM_FIELD_GROUPS.has(groupId)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ id: id as `custom-${string}`, label, groupId });
  }
  return result;
}

function normalizeOperationalGuide(raw: unknown): ProductOperationalGuide | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const storageId = String(row.storageId ?? "").trim();
  if (!storageId) return null;
  return {
    storageId,
    fileName: String(row.fileName ?? "").trim() || "roteiro.pdf",
    displayName: String(row.displayName ?? "").trim(),
  };
}

export function normalizeProductFields(
  product: import("@/lib/config/settings-types").ProductConfig,
): import("@/lib/config/settings-types").ProductConfig {
  const customFields = normalizeCustomFields(product.customFields);
  const customIdSet = new Set(customFields.map((field) => field.id));
  const requiredFieldIds = migrateFieldIdList(product.requiredFieldIds ?? [], customIdSet);
  const requiredSet = new Set(requiredFieldIds);
  const availableBuiltins = ALL_CLIENT_FIELD_IDS.filter((id) => !requiredSet.has(id));
  const availableCustom = customFields.map((field) => field.id).filter((id) => !requiredSet.has(id));
  const availableFieldIds = [...availableBuiltins, ...availableCustom];
  const name = String(product.name ?? "").trim();
  // Tag segue o nome do produto (sem campo separado na UI)
  const tag = name || String(product.tag ?? "").trim();
  const bankIds = Array.isArray(product.bankIds)
    ? [...new Set(product.bankIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];
  const operationalGuideEnabled = Boolean(product.operationalGuideEnabled);
  const operationalGuide = operationalGuideEnabled
    ? normalizeOperationalGuide(product.operationalGuide)
    : null;
  return {
    ...product,
    name,
    tag,
    color: normalizeStatusColor(product.color, DEFAULT_STATUS_COLOR),
    bankIds,
    availableForPartners: Boolean(product.availableForPartners),
    partnerOnly: Boolean(product.partnerOnly),
    customFields,
    availableFieldIds,
    requiredFieldIds,
    operationalGuideEnabled: Boolean(operationalGuide),
    operationalGuide,
  };
}

/** Texto exibido na tag colorida — sempre o nome do produto. */
export function resolveProductTagLabel(
  product: Pick<import("@/lib/config/settings-types").ProductConfig, "name" | "tag">,
): string {
  return product.name.trim() || product.tag.trim() || "Produto";
}
