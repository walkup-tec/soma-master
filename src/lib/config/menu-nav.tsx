import type { ComponentType } from "react";
import {
  Bell,
  CalendarDays,
  Columns3,
  LayoutDashboard,
  MessageCircle,
  Megaphone,
  Settings,
  Network,
  UserCog,
  Users,
} from "lucide-react";
import type { MenuItemId } from "@/lib/config/menu-items";

export const MENU_ICONS: Record<MenuItemId, ComponentType<{ className?: string }>> = {
  parceiros: Network,
  dashboard: LayoutDashboard,
  clientes: Users,
  kanban: Columns3,
  remarketing: Megaphone,
  agenda: CalendarDays,
  chat: MessageCircle,
  usuarios: UserCog,
  push: Bell,
  configuracoes: Settings,
};
