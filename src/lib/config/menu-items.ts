export type MenuItemId =
  | "dashboard"
  | "clientes"
  | "kanban"
  | "remarketing"
  | "agenda"
  | "usuarios"
  | "configuracoes";

export type MenuGroupId = "Operação" | "Comercial" | "Gestão";

export type MenuItemDefinition = {
  id: MenuItemId;
  label: string;
  group: MenuGroupId;
  /** Rota principal do módulo (prefixo para sub-rotas). */
  path: string;
};

/** Fonte única dos recursos do sistema — novos menus entram aqui e aparecem nas categorias. */
export const MENU_ITEMS: MenuItemDefinition[] = [
  { id: "dashboard", label: "Dashboard", group: "Operação", path: "/app" },
  { id: "clientes", label: "Clientes", group: "Operação", path: "/app/clientes" },
  { id: "kanban", label: "Kanban", group: "Comercial", path: "/app/kanban" },
  { id: "remarketing", label: "Remarketing", group: "Comercial", path: "/app/remarketing" },
  { id: "agenda", label: "Agenda", group: "Comercial", path: "/app/agenda" },
  { id: "usuarios", label: "Usuários", group: "Gestão", path: "/app/usuarios" },
  { id: "configuracoes", label: "Configurações", group: "Gestão", path: "/app/configuracoes" },
];

export const ALL_MENU_ITEM_IDS = MENU_ITEMS.map((m) => m.id);

export const MENU_GROUPS: MenuGroupId[] = ["Operação", "Comercial", "Gestão"];

export function getMenuItemById(id: MenuItemId): MenuItemDefinition | undefined {
  return MENU_ITEMS.find((m) => m.id === id);
}

/** Resolve qual módulo uma URL do app pertence. */
export function menuIdForPath(pathname: string): MenuItemId | null {
  const normalized = pathname.replace(/\/+$/, "") || "/app";
  if (normalized === "/app") return "dashboard";

  const matches = MENU_ITEMS.filter((item) => item.id !== "dashboard" && normalized.startsWith(item.path));
  if (matches.length === 0) return null;

  return matches.sort((a, b) => b.path.length - a.path.length)[0]?.id ?? null;
}

export function filterMenuItemsByIds(menuIds: MenuItemId[]): MenuItemDefinition[] {
  const allowed = new Set(menuIds);
  return MENU_ITEMS.filter((item) => allowed.has(item.id));
}

export function groupMenuItems(items: MenuItemDefinition[]): Record<MenuGroupId, MenuItemDefinition[]> {
  return MENU_GROUPS.reduce(
    (groups, group) => {
      groups[group] = items.filter((item) => item.group === group);
      return groups;
    },
    {} as Record<MenuGroupId, MenuItemDefinition[]>,
  );
}
