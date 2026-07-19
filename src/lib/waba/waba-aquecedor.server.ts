import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig } from "@/lib/auth/session-config";
import { fetchWabaAquecedorInstances } from "@/lib/waba/waba-aquecedor.adapter";

async function requireMarketingAccess() {
  const session = await getSession(sessionConfig);
  const user = session.data;
  if (!user?.userId) throw new Error("Não autenticado.");
  if (!sessionCanAccessMenu(user, "marketing")) {
    throw new Error("Sem permissão para Funil e WhatsApp.");
  }
  return user;
}

export const listWabaAquecedorInstancesFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireMarketingAccess();
  return fetchWabaAquecedorInstances();
});
