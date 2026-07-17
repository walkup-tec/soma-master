export type MenuItemId =
  | "parceiros"
  | "dashboard"
  | "clientes"
  | "kanban"
  | "remarketing"
  | "agenda"
  | "chat"
  | "usuarios"
  | "push"
  | "configuracoes";

/** Duas grandes seções do menu lateral. */
export type MenuSectionId = "parceiros" | "producao-propria";

/** Subgrupos internos (usados em Produção própria e nas categorias de usuário). */
export type MenuGroupId = "Operação" | "Comercial" | "Gestão";

export type MenuSectionDefinition = {
  id: MenuSectionId;
  label: string;
};

export type MenuItemDefinition = {
  id: MenuItemId;
  label: string;
  section: MenuSectionId;
  group: MenuGroupId;
  /** Rota principal do módulo (prefixo para sub-rotas). */
  path: string;
};

export const MENU_SECTIONS: MenuSectionDefinition[] = [
  { id: "parceiros", label: "Parceiros" },
  { id: "producao-propria", label: "Produção própria" },
];

/** Fonte única dos recursos do sistema — novos menus entram aqui e aparecem nas categorias. */
export const MENU_ITEMS: MenuItemDefinition[] = [
  {
    id: "parceiros",
    label: "Parceiros",
    section: "parceiros",
    group: "Gestão",
    path: "/app/parceiros",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    section: "producao-propria",
    group: "Operação",
    path: "/app",
  },
  {
    id: "clientes",
    label: "Clientes",
    section: "producao-propria",
    group: "Operação",
    path: "/app/clientes",
  },
  {
    id: "kanban",
    label: "Kanban",
    section: "producao-propria",
    group: "Comercial",
    path: "/app/kanban",
  },
  {
    id: "remarketing",
    label: "Remarketing",
    section: "producao-propria",
    group: "Comercial",
    path: "/app/remarketing",
  },
  {
    id: "agenda",
    label: "Agenda",
    section: "producao-propria",
    group: "Comercial",
    path: "/app/agenda",
  },
  {
    id: "chat",
    label: "Chat WhatsApp",
    section: "producao-propria",
    group: "Comercial",
    path: "/app/chat",
  },
  {
    id: "usuarios",
    label: "Usuários",
    section: "producao-propria",
    group: "Gestão",
    path: "/app/usuarios",
  },
  {
    id: "push",
    label: "Push",
    section: "producao-propria",
    group: "Gestão",
    path: "/app/push",
  },
  {
    id: "configuracoes",
    label: "Configurações",
    section: "producao-propria",
    group: "Gestão",
    path: "/app/configuracoes",
  },
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

  const matches = MENU_ITEMS.filter(
    (item) => item.id !== "dashboard" && normalized.startsWith(item.path),
  );
  if (matches.length === 0) return null;

  return matches.sort((a, b) => b.path.length - a.path.length)[0]?.id ?? null;
}

export function filterMenuItemsByIds(menuIds: MenuItemId[]): MenuItemDefinition[] {
  const allowed = new Set(menuIds);
  return MENU_ITEMS.filter((item) => allowed.has(item.id));
}

export function groupMenuItems(
  items: MenuItemDefinition[],
): Record<MenuGroupId, MenuItemDefinition[]> {
  return MENU_GROUPS.reduce(
    (groups, group) => {
      groups[group] = items.filter((item) => item.group === group);
      return groups;
    },
    {} as Record<MenuGroupId, MenuItemDefinition[]>,
  );
}

export function itemsBySection(
  items: MenuItemDefinition[],
  sectionId: MenuSectionId,
): MenuItemDefinition[] {
  return items.filter((item) => item.section === sectionId);
}
