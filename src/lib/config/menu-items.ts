export type MenuItemId =
  | "dashboard"
  | "clientes"
  | "remarketing"
  | "agenda"
  | "whatsapp"
  | "documentos"
  | "relatorios"
  | "configuracoes";

export type MenuItemDefinition = {
  id: MenuItemId;
  label: string;
  group: "Operação" | "Comercial" | "Gestão";
};

export const MENU_ITEMS: MenuItemDefinition[] = [
  { id: "dashboard", label: "Dashboard", group: "Operação" },
  { id: "clientes", label: "Clientes", group: "Operação" },
  { id: "remarketing", label: "Remarketing", group: "Comercial" },
  { id: "agenda", label: "Agenda", group: "Comercial" },
  { id: "whatsapp", label: "WhatsApp", group: "Comercial" },
  { id: "documentos", label: "Documentos", group: "Gestão" },
  { id: "relatorios", label: "Relatórios", group: "Gestão" },
  { id: "configuracoes", label: "Configurações", group: "Gestão" },
];

export const ALL_MENU_ITEM_IDS = MENU_ITEMS.map((m) => m.id);
