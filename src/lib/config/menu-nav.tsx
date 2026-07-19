import type { ComponentType } from "react";
import {
  Bell,
  CalendarDays,
  Columns3,
  Landmark,
  LayoutDashboard,
  MessageCircle,
  Megaphone,
  Package,
  Settings,
  Network,
  Table2,
  Target,
  UserCog,
  Users,
} from "lucide-react";
import type { MenuItemId } from "@/lib/config/menu-items";

export const MENU_ICONS: Record<MenuItemId, ComponentType<{ className?: string }>> = {
  parceiros: Network,
  "parceiros-bancos": Landmark,
  "parceiros-produtos": Package,
  "parceiros-tabelas": Table2,
  dashboard: LayoutDashboard,
  clientes: Users,
  kanban: Columns3,
  remarketing: Megaphone,
  agenda: CalendarDays,
  marketing: Target,
  chat: MessageCircle,
  usuarios: UserCog,
  push: Bell,
  configuracoes: Settings,
};
