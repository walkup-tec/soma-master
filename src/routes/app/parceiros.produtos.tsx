import { createFileRoute } from "@tanstack/react-router";
import { PartnerProductsCatalogScreen } from "@/components/partners/partner-products-catalog-screen";
import { listPartnerProductBankRowsFn } from "@/lib/partners/partner-catalog.server";

export const Route = createFileRoute("/app/parceiros/produtos")({
  loader: async () => {
    const rows = await listPartnerProductBankRowsFn();
    return { rows };
  },
  staleTime: 10_000,
  component: PartnerProductsPage,
});

function PartnerProductsPage() {
  const { rows } = Route.useLoaderData();
  return <PartnerProductsCatalogScreen initialRows={rows} />;
}
