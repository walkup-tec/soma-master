import type { ComponentType } from "react";
import {
  CalendarDays,
  Columns3,
  LayoutDashboard,
  Megaphone,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import type { MenuItemId } from "@/lib/config/menu-items";

export const MENU_ICONS: Record<MenuItemId, ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  clientes: Users,
  kanban: Columns3,
  remarketing: Megaphone,
  agenda: CalendarDays,
  usuarios: UserCog,
  configuracoes: Settings,
};
