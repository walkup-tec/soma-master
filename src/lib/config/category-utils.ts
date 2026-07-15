import { MENU_ITEMS } from "@/lib/config/menu-items";
import type { MenuItemId } from "@/lib/config/menu-items";
import type { SystemSettings, UserCategory } from "@/lib/config/settings-types";

/** Tela inicial válida para a lista de menus da categoria. */
export function resolveCategoryHomeMenuId(
  menuIds: MenuItemId[],
  preferred?: MenuItemId | null,
): MenuItemId {
  if (preferred && menuIds.includes(preferred)) return preferred;
  if (menuIds.includes("dashboard")) return "dashboard";
  return menuIds[0] ?? "dashboard";
}

export function getCategoryById(settings: SystemSettings, categoryId: string): UserCategory | undefined {
  return settings.categories.find((c) => c.id === categoryId);
}

/** Todas as categorias criadas pelo master estão disponíveis no cadastro de usuários. */
export function listAssignableCategories(settings: SystemSettings): UserCategory[] {
  return settings.categories;
}

/** Permissões conforme a categoria escolhida no cadastro do usuário. */
export function resolveUserCategoryTemplate(
  settings: SystemSettings,
  categoryId: string,
): UserCategory | undefined {
  return getCategoryById(settings, categoryId);
}

export function menuLabelsForCategory(category: UserCategory): string[] {
  return category.menuIds
    .map((id) => MENU_ITEMS.find((m) => m.id === id)?.label)
    .filter((label): label is string => Boolean(label));
}

export function categoryHasMenu(category: UserCategory, menuId: MenuItemId): boolean {
  return category.menuIds.includes(menuId);
}
