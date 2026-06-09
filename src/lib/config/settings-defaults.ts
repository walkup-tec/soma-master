import { ALL_CLIENT_FIELD_IDS } from "@/lib/config/client-fields";
import { ALL_MENU_ITEM_IDS, type MenuItemId } from "@/lib/config/menu-items";
import type { SystemSettings } from "@/lib/config/settings-types";

const masterCategoryId = "cat-master";
const atendenteCategoryId = "cat-atendente";

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  defaultCategoryId: atendenteCategoryId,
  categories: [
    {
      id: masterCategoryId,
      name: "Master",
      menuIds: [...ALL_MENU_ITEM_IDS],
      isDefault: false,
    },
    {
      id: atendenteCategoryId,
      name: "Atendente",
      menuIds: ["dashboard", "clientes", "agenda"],
      isDefault: true,
    },
  ],
  products: [
    {
      id: "prod-clt",
      name: "Empréstimo CLT",
      availableFieldIds: [
        "nome",
        "cpf",
        "telefone",
        "whatsapp",
        "tipo_cliente",
        "empresa",
        "renda_mensal",
        "margem_disponivel",
        "valor_desejado",
      ],
      requiredFieldIds: ["nome", "cpf", "telefone", "tipo_cliente", "renda_mensal"],
    },
    {
      id: "prod-fgts",
      name: "Antecipação FGTS",
      availableFieldIds: ["nome", "cpf", "telefone", "whatsapp", "valor_desejado", "valor_liberado"],
      requiredFieldIds: ["nome", "cpf", "telefone"],
    },
  ],
};

export function createEmptyProduct(): import("@/lib/config/settings-types").ProductConfig {
  return {
    id: `prod-${crypto.randomUUID().slice(0, 8)}`,
    name: "",
    availableFieldIds: [],
    requiredFieldIds: [],
  };
}

export function createEmptyCategory(): import("@/lib/config/settings-types").UserCategory {
  return {
    id: `cat-${crypto.randomUUID().slice(0, 8)}`,
    name: "",
    menuIds: ["dashboard", "clientes"],
    isDefault: false,
  };
}

/** Garante que obrigatórios ⊆ disponíveis e defaultCategoryId válido. */
export function normalizeSettings(settings: SystemSettings): SystemSettings {
  const categories =
    settings.categories.length > 0 ? settings.categories : DEFAULT_SYSTEM_SETTINGS.categories;

  const defaultCategoryId = categories.some((c) => c.id === settings.defaultCategoryId)
    ? settings.defaultCategoryId
    : (categories.find((c) => c.isDefault)?.id ?? categories[0].id);

  const validMenuIds = new Set(ALL_MENU_ITEM_IDS);
  const normalizedCategories = categories.map((c) => ({
    ...c,
    isDefault: c.id === defaultCategoryId,
    menuIds: c.menuIds.filter((id): id is MenuItemId => validMenuIds.has(id as MenuItemId)),
  }));

  const products = settings.products.map((p) => {
    const available = p.availableFieldIds.filter((id) => ALL_CLIENT_FIELD_IDS.includes(id));
    const required = p.requiredFieldIds.filter((id) => available.includes(id));
    return { ...p, availableFieldIds: available, requiredFieldIds: required };
  });

  return {
    defaultCategoryId,
    categories: normalizedCategories,
    products,
  };
}
