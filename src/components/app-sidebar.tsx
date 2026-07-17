import { Link, useRouterState } from "@tanstack/react-router";
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
  groupMenuItems,
  itemsBySection,
  MENU_GROUPS,
  MENU_SECTIONS,
} from "@/lib/config/menu-items";
import { MENU_ICONS } from "@/lib/config/menu-nav";
import type { SessionData } from "@/lib/auth/session-config";

export function AppSidebar({ auth }: { auth: SessionData }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });

  const allowedItems = filterMenuItemsByIds(auth.menuIds);

  const isActive = (url: string) => (url === "/app" ? path === "/app" : path.startsWith(url));

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
                <div className="mx-2 mb-1 rounded-md border border-sidebar-border/70 bg-sidebar-accent/60 px-3 py-2 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/85">
                    {section.label}
                  </p>
                </div>
              ) : null}

              {hasItems ? (
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
              ) : null}
            </div>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
