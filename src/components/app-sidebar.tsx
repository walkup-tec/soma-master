import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  CalendarDays,
  Folder,
  BarChart3,
  Settings,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/logo";

type NavItem = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const OPERACAO: NavItem[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Clientes", url: "/app/clientes", icon: Users },
];
const COMERCIAL: NavItem[] = [
  { title: "Remarketing", url: "/app/remarketing", icon: Megaphone },
  { title: "Agenda", url: "/app/agenda", icon: CalendarDays },
];
const GESTAO: NavItem[] = [
  { title: "Documentos", url: "/app/documentos", icon: Folder },
  { title: "Relatórios", url: "/app/relatorios", icon: BarChart3 },
  { title: "Configurações", url: "/app/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (url: string) => (url === "/app" ? path === "/app" : path.startsWith(url));

  const renderGroup = (label: string, items: NavItem[]) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-sidebar-foreground/60">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
                className="data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-primary data-[active=true]:font-semibold"
              >
                <Link to={item.url} className="flex items-center gap-3">
                  <item.icon className="size-4 shrink-0" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-4">
        <Logo compact={collapsed} className={collapsed ? "justify-center" : ""} />
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Operação", OPERACAO)}
        {renderGroup("Comercial", COMERCIAL)}
        {renderGroup("Gestão", GESTAO)}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/60 p-3">
        {!collapsed ? (
          <div className="rounded-xl bg-sidebar-accent/60 p-3 text-xs text-sidebar-accent-foreground">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <Sparkles className="size-3.5 text-sidebar-primary" /> Sinal IA
            </div>
            <p className="text-sidebar-foreground/70">Sugestões de remarketing baseadas em score.</p>
          </div>
        ) : (
          <Sparkles className="mx-auto size-4 text-sidebar-primary" />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
