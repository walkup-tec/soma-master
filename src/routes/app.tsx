import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { ChatbotAlertProvider } from "@/components/chat/chatbot-alert-context";
import { getAuthSessionFn } from "@/lib/auth/auth.server";
import { guardAppMenuAccess } from "@/lib/auth/menu-guard.server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";

const SESSION_SYNC_MS = 120_000;

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location }) => {
    const auth = await guardAppMenuAccess(location.pathname);
    return { auth };
  },
  // Evita refetch agressivo dos loaders filhos a cada troca de aba/foco.
  staleTime: 60_000,
  component: AppLayout,
});

function AppLayout() {
  const { auth } = Route.useRouteContext();
  const router = useRouter();
  const refreshSession = useServerFn(getAuthSessionFn);
  const lastAccessKeyRef = useRef(
    `${auth.userId}|${auth.role}|${auth.categoryId}|${auth.menuIds.join(",")}|${auth.homeMenuId}`,
  );

  useEffect(() => {
    let active = true;

    const syncAccess = async () => {
      try {
        const next = await refreshSession();
        if (!active || !next?.userId) return;

        const accessKey = `${next.userId}|${next.role}|${next.categoryId}|${next.menuIds.join(",")}|${next.homeMenuId}`;
        if (accessKey === lastAccessKeyRef.current) return;

        lastAccessKeyRef.current = accessKey;
        // Só invalida se permissões/menu mudaram — não a cada poll.
        await router.invalidate();
      } catch {
        /* sessão expirada ou rede */
      }
    };

    const onFocus = () => void syncAccess();
    window.addEventListener("focus", onFocus);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncAccess();
    }, SESSION_SYNC_MS);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [refreshSession, router]);

  const chatbotAlertsEnabled = sessionCanAccessMenu(auth, "chat");

  return (
    <ChatbotAlertProvider enabled={chatbotAlertsEnabled}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar auth={auth} />
          <SidebarInset className="flex min-w-0 flex-1 flex-col">
            <AppTopbar user={auth} />
            <main className="flex-1 p-4 md:p-6">
              <Outlet />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ChatbotAlertProvider>
  );
}
