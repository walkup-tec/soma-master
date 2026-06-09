import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { getAuthSessionFn } from "@/lib/auth/auth.server";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const auth = await getAuthSessionFn();
    if (!auth) {
      throw redirect({ to: "/login" });
    }
    return { auth };
  },
  component: AppLayout,
});

function AppLayout() {
  const { auth } = Route.useRouteContext();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <AppTopbar user={auth} />
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
