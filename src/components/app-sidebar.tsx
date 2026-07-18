import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import {
  filterMenuItemsByIds,
  getMenuItemById,
  groupMenuItems,
  itemsBySection,
  menuIdForPath,
  MENU_GROUPS,
  MENU_SECTIONS,
  type MenuSectionId,
} from "@/lib/config/menu-items";
import { MENU_ICONS } from "@/lib/config/menu-nav";
import type { SessionData } from "@/lib/auth/session-config";
import { cn } from "@/lib/utils";

const SECTION_OPEN_STORAGE_KEY = "soma.sidebar.sectionsOpen";

function readStoredOpen(): Partial<Record<MenuSectionId, boolean>> {
  try {
    const raw = sessionStorage.getItem(SECTION_OPEN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<MenuSectionId, boolean>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredOpen(value: Record<MenuSectionId, boolean>): void {
  try {
    sessionStorage.setItem(SECTION_OPEN_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function AppSidebar({ auth }: { auth: SessionData }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });

  const allowedItems = filterMenuItemsByIds(auth.menuIds);

  const activeSectionId = useMemo((): MenuSectionId | null => {
    for (const section of MENU_SECTIONS) {
      const items = itemsBySection(allowedItems, section.id);
      if (items.some((item) => (item.path === "/app" ? path === "/app" : path.startsWith(item.path)))) {
        return section.id;
      }
    }
    return null;
  }, [allowedItems, path]);

  const [openBySection, setOpenBySection] = useState<Record<MenuSectionId, boolean>>(() => {
    const stored = typeof window !== "undefined" ? readStoredOpen() : {};
    return {
      parceiros: stored.parceiros ?? true,
      "producao-propria": stored["producao-propria"] ?? true,
    };
  });

  useEffect(() => {
    if (!activeSectionId) return;
    setOpenBySection((current) => {
      if (current[activeSectionId]) return current;
      const next = { ...current, [activeSectionId]: true };
      writeStoredOpen(next);
      return next;
    });
  }, [activeSectionId]);

  const toggleSection = (sectionId: MenuSectionId) => {
    setOpenBySection((current) => {
      const next = { ...current, [sectionId]: !current[sectionId] };
      writeStoredOpen(next);
      return next;
    });
  };

  /** Maior prefixo do menu — evita "Parceiros" ativo em /parceiros/bancos. */
  const isActive = (url: string) => {
    if (url === "/app") return path === "/app" || path === "/app/";
    const menuId = menuIdForPath(path);
    return menuId ? getMenuItemById(menuId)?.path === url : false;
  };

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-4">
        <Logo
          compact={collapsed}
          surface="brand"
          className={collapsed ? "justify-center" : ""}
        />
      </SidebarHeader>
      <SidebarContent>
        {MENU_SECTIONS.map((section, sectionIndex) => {
          const sectionItems = itemsBySection(allowedItems, section.id);
          const grouped = groupMenuItems(sectionItems);
          const hasItems = sectionItems.length > 0;
          const isOpen = collapsed ? true : openBySection[section.id] !== false;

          return (
            <div
              key={section.id}
              className={
                sectionIndex === 0
                  ? "pb-3"
                  : "mt-2 border-t-2 border-sidebar-border/80 pb-3 pt-3"
              }
            >
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={isOpen}
                  className="mx-2 mb-1 flex w-[calc(100%-1rem)] items-center justify-between gap-2 rounded-md border border-sidebar-border/70 bg-sidebar-accent/60 px-3 py-2 text-left shadow-sm transition-colors hover:bg-sidebar-accent"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/85">
                    {section.label}
                  </p>
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 text-sidebar-foreground/70 transition-transform duration-200",
                      !isOpen && "-rotate-90",
                    )}
                    aria-hidden
                  />
                </button>
              ) : null}

              {isOpen ? (
                hasItems ? (
                  MENU_GROUPS.map((group) => {
                    const items = grouped[group];
                    if (!items.length) return null;
                    return (
                      <SidebarGroup key={`${section.id}-${group}`}>
                        {!collapsed ? (
                          <SidebarGroupLabel className="text-sidebar-foreground/60">
                            {group}
                          </SidebarGroupLabel>
                        ) : null}
                        <SidebarGroupContent>
                          <SidebarMenu>
                            {items.map((item) => {
                              const Icon = MENU_ICONS[item.id];
                              return (
                                <SidebarMenuItem key={item.id}>
                                  <SidebarMenuButton
                                    asChild
                                    isActive={isActive(item.path)}
                                    tooltip={item.label}
                                    className="data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-primary data-[active=true]:font-semibold"
                                  >
                                    <Link
                                      to={item.path}
                                      preload="intent"
                                      className="flex items-center gap-3"
                                    >
                                      <Icon className="size-4 shrink-0" />
                                      <span>{item.label}</span>
                                    </Link>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              );
                            })}
                          </SidebarMenu>
                        </SidebarGroupContent>
                      </SidebarGroup>
                    );
                  })
                ) : !collapsed ? (
                  <p className="px-5 py-2 text-xs italic text-sidebar-foreground/45">Em breve</p>
                ) : null
              ) : null}
            </div>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
