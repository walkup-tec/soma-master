import { useRouterState, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AgendaTopbarAlerts } from "@/components/agenda/agenda-topbar-alerts";
import { ChatbotTopbarIcon } from "@/components/chat/chatbot-topbar-icon";
import { PushTopbarBell } from "@/components/push/push-topbar-bell";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { SessionData } from "@/lib/auth/session-config";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { logoutFn } from "@/lib/auth/auth.server";
import { readDomSomaTheme, readStoredSomaTheme } from "@/lib/theme/soma-theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TITLES: Record<string, string> = {
  "/app": "Dashboard",
  "/app/parceiros": "Parceiros",
  "/app/parceiros/bancos": "Bancos",
  "/app/parceiros/produtos": "Produtos",
  "/app/parceiros/tabelas": "Tabelas",
  "/app/parceiros/solicitacao-usuario": "Solicitação Usuário",
  "/app/clientes": "Clientes",
  "/app/clientes/novo": "Novo cliente",
  "/app/kanban": "Kanban",
  "/app/remarketing": "Remarketing",
  "/app/agenda": "Agenda & Follow-up",
  "/app/chat": "Chat WhatsApp",
  "/app/marketing": "Funil e WhatsApp",
  "/app/usuarios": "Usuários",
  "/app/push": "Push",
  "/app/configuracoes": "Configurações",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppTopbar({ user }: { user: SessionData }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const logout = useServerFn(logoutFn);
  // Nunca iniciar em false fixo — isso apagava o dark do bootstrap no useEffect
  const [dark, setDark] = useState(() => {
    if (typeof document === "undefined") return false;
    return readDomSomaTheme() === "dark" || readStoredSomaTheme() === "dark";
  });

  useEffect(() => {
    const sync = () => setDark(readDomSomaTheme() === "dark");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const segs = path.split("/").filter(Boolean);
  const crumbs = segs.map((seg, i) => {
    const url = "/" + segs.slice(0, i + 1).join("/");
    return { label: TITLES[url] ?? seg, url };
  });
  const title = TITLES[path] ?? crumbs.at(-1)?.label ?? "Soma Promotora";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <div className="hidden md:flex flex-col">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          {crumbs.map((c, i) => (
            <span key={c.url} className="flex items-center gap-1">
              {i > 0 && <span className="opacity-50">/</span>}
              <Link to={c.url} className="hover:text-foreground transition-colors">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
        <h1 className="font-display text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {sessionCanAccessMenu(user, "chat") ? <ChatbotTopbarIcon /> : null}
        <PushTopbarBell />
        {sessionCanAccessMenu(user, "agenda") ? <AgendaTopbarAlerts /> : null}
        {sessionCanAccessMenu(user, "clientes") ? (
          <Button
            asChild
            size="sm"
            className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-soft hidden sm:inline-flex"
          >
            <Link to="/app/clientes/novo">
              <Plus className="size-4" /> Novo cliente
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-theme-toggle
          aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
          title={dark ? "Ativar modo claro" : "Ativar modo escuro"}
        >
          {/* Toggle só no bootstrap (capture) — evita clique duplo React+script */}
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-muted transition-colors"
            >
              <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {initials(user.name)}
              </span>
              <span className="hidden md:block text-left leading-tight">
                <span className="block text-xs font-semibold">{user.name}</span>
                <span className="block text-[10px] text-muted-foreground capitalize">
                  {user.role}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Perfil</DropdownMenuItem>
            <DropdownMenuItem>Preferências</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await logout();
                await navigate({ to: "/login" });
              }}
            >
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
