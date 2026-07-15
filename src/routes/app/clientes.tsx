import { createFileRoute } from "@tanstack/react-router";
import { ClientsScreen } from "@/components/clients/clients-screen";
import { listClientsFn } from "@/lib/clients/clients.server";

export const Route = createFileRoute("/app/clientes")({
  loader: async () => {
    const clientsPage = await listClientsFn({ data: { page: 1, pageSize: 50, search: "" } });
    return { clientsPage };
  },
  staleTime: 30_000,
  component: ClientesPage,
});

function ClientesPage() {
  const { clientsPage } = Route.useLoaderData();
  return <ClientsScreen initialPage={clientsPage} />;
}
