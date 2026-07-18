import { createFileRoute } from "@tanstack/react-router";
import { PartnersScreen } from "@/components/partners/partners-screen";
import { listPartnersFn } from "@/lib/partners/partners.server";

export const Route = createFileRoute("/app/parceiros/")({
  loader: async () => {
    const partners = await listPartnersFn({
      data: {
        status: "active",
        search: "",
        production: "all",
        bankIds: [],
        page: 1,
        pageSize: 20,
      },
    });
    return { partners };
  },
  staleTime: 15_000,
  component: PartnersPage,
});

function PartnersPage() {
  const { partners } = Route.useLoaderData();
  return <PartnersScreen initialData={partners} />;
}
