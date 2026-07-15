import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig } from "@/lib/auth/session-config";
import { getDashboardSummaryForUser } from "@/lib/clients/clients.repository";

function requireDashboardAccess() {
  return getSession(sessionConfig).then((session) => {
    const user = session.data;
    if (!user?.userId) throw new Error("Não autenticado.");
    if (!sessionCanAccessMenu(user, "dashboard")) {
      throw new Error("Sem permissão para acessar o Dashboard.");
    }
    return user;
  });
}

export const getDashboardSummaryFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireDashboardAccess();
  return getDashboardSummaryForUser(user.userId, user.role === "master");
});
