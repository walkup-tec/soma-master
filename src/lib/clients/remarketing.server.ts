import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig } from "@/lib/auth/session-config";
import { listRemarketingClientsForUser } from "@/lib/clients/clients.repository";
import type { RemarketingFilter, RemarketingListQuery } from "@/lib/clients/client.types";

function requireRemarketingAccess() {
  return getSession(sessionConfig).then((session) => {
    const user = session.data;
    if (!user?.userId) throw new Error("Não autenticado.");
    if (!sessionCanAccessMenu(user, "remarketing")) {
      throw new Error("Sem permissão para acessar o Remarketing.");
    }
    return user;
  });
}

const remarketingListSchema = (data: unknown): RemarketingListQuery => {
  if (!data || typeof data !== "object") return { filter: "today" };
  const payload = data as { filter?: string };
  const filter: RemarketingFilter | undefined =
    payload.filter === "week" ||
    payload.filter === "next15" ||
    payload.filter === "next30" ||
    payload.filter === "today"
      ? payload.filter
      : undefined;
  return { filter };
};

export const listRemarketingFn = createServerFn({ method: "POST" })
  .inputValidator(remarketingListSchema)
  .handler(async ({ data }) => {
    const user = await requireRemarketingAccess();
    return listRemarketingClientsForUser(user.userId, user.role === "master", data);
  });
