import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig } from "@/lib/auth/session-config";
import { listKanbanClientsForUser } from "@/lib/clients/clients.repository";

function requireKanbanAccess() {
  return getSession(sessionConfig).then((session) => {
    const user = session.data;
    if (!user?.userId) throw new Error("Não autenticado.");
    if (!sessionCanAccessMenu(user, "kanban")) {
      throw new Error("Sem permissão para acessar o Kanban.");
    }
    return user;
  });
}

export const listKanbanFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireKanbanAccess();
  return listKanbanClientsForUser(user.userId, user.role === "master");
});
