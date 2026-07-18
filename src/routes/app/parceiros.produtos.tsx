import { createFileRoute } from "@tanstack/react-router";
import { PartnerProductsCatalogScreen } from "@/components/partners/partner-products-catalog-screen";
import {
  listPartnerProductBankRowsFn,
  listPartnerVisibleBanksFn,
} from "@/lib/partners/partner-catalog.server";

export const Route = createFileRoute("/app/parceiros/produtos")({
  loader: async () => {
    const [rows, banks] = await Promise.all([
      listPartnerProductBankRowsFn(),
      listPartnerVisibleBanksFn(),
    ]);
    return { rows, banks };
  },
  staleTime: 10_000,
  component: PartnerProductsPage,
});

function PartnerProductsPage() {
  const { rows, banks } = Route.useLoaderData();
  return <PartnerProductsCatalogScreen initialRows={rows} initialBanks={banks} />;
}
