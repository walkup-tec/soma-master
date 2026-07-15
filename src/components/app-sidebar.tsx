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
import { filterMenuItemsByIds, groupMenuItems, MENU_GROUPS } from "@/lib/config/menu-items";
import { MENU_ICONS } from "@/lib/config/menu-nav";
import type { SessionData } from "@/lib/auth/session-config";

export function AppSidebar({ auth }: { auth: SessionData }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });

  const allowedItems = filterMenuItemsByIds(auth.menuIds);
  const grouped = groupMenuItems(allowedItems);

  const isActive = (url: string) => (url === "/app" ? path === "/app" : path.startsWith(url));

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-4">
        <Logo compact={collapsed} className={collapsed ? "justify-center" : ""} />
      </SidebarHeader>
      <SidebarContent>
        {MENU_GROUPS.map((group) => {
          const items = grouped[group];
          if (!items.length) return null;
          return (
            <SidebarGroup key={group}>
              {!collapsed && <SidebarGroupLabel className="text-sidebar-foreground/60">{group}</SidebarGroupLabel>}
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
                          <Link to={item.path} preload="intent" className="flex items-center gap-3">
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
        })}
      </SidebarContent>
    </Sidebar>
  );
}
