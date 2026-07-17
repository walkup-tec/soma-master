import { createFileRoute, redirect } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { PushScreen } from "@/components/push/push-screen";
import { getAuthSessionFn } from "@/lib/auth/auth.server";

export const Route = createFileRoute("/app/push")({
  beforeLoad: async () => {
    const auth = await getAuthSessionFn();
    if (!auth || auth.role !== "master") {
      throw redirect({ to: "/app" });
    }
  },
  component: PushPage,
});

function PushPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Bell className="size-5" />
          <span className="text-sm font-medium">Gestão</span>
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Push</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Comunicados no sininho, e-mail e comunidade WhatsApp da Soma Promotora.
        </p>
      </div>

      <PushScreen />
    </div>
  );
}
