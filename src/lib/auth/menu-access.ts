import { getMenuItemById, menuIdForPath, type MenuItemId } from "@/lib/config/menu-items";
import type { SessionData } from "@/lib/auth/session-config";

export function sessionCanAccessMenu(session: SessionData, menuId: MenuItemId): boolean {
  if (session.role === "master") return true;
  return session.menuIds.includes(menuId);
}

export function sessionCanAccessPath(session: SessionData, pathname: string): boolean {
  const menuId = menuIdForPath(pathname);
  if (!menuId) return true;
  return sessionCanAccessMenu(session, menuId);
}

export function firstAllowedAppPath(session: SessionData): string {
  const preferred = session.homeMenuId;
  if (preferred && sessionCanAccessMenu(session, preferred)) {
    return getMenuItemById(preferred)?.path ?? "/app";
  }
  if (sessionCanAccessMenu(session, "dashboard")) return "/app";
  const first = session.menuIds[0];
  if (!first) return "/app";
  return getMenuItemById(first)?.path ?? "/app";
}
