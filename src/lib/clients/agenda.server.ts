import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig } from "@/lib/auth/session-config";
import type { AgendaFilter, AgendaListQuery } from "@/lib/clients/client.types";
import {
  getAgendaAlertCountsForUser,
  listScheduledClientsForUser,
} from "@/lib/clients/clients.repository";

function requireAgendaAccess() {
  return getSession(sessionConfig).then((session) => {
    const user = session.data;
    if (!user?.userId) throw new Error("Não autenticado.");
    if (!sessionCanAccessMenu(user, "agenda")) {
      throw new Error("Sem permissão para acessar a agenda.");
    }
    return user;
  });
}

const agendaListSchema = (data: unknown): AgendaListQuery => {
  if (!data || typeof data !== "object") return { filter: "today" };
  const payload = data as { filter?: string; pendingOnly?: boolean };
  const filter: AgendaFilter | undefined =
    payload.filter === "tomorrow" ||
    payload.filter === "all" ||
    payload.filter === "overdue" ||
    payload.filter === "today"
      ? payload.filter
      : undefined;
  return {
    filter,
    pendingOnly: payload.pendingOnly === true,
  };
};

export const listAgendaFn = createServerFn({ method: "POST" })
  .inputValidator(agendaListSchema)
  .handler(async ({ data }) => {
    const user = await requireAgendaAccess();
    return listScheduledClientsForUser(user.userId, user.role === "master", data);
  });

export const getAgendaAlertsFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireAgendaAccess();
  return getAgendaAlertCountsForUser(user.userId, user.role === "master");
});
