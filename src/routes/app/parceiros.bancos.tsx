import { createFileRoute } from "@tanstack/react-router";
import { PartnerBanksCatalogScreen } from "@/components/partners/partner-banks-catalog-screen";
import { listPartnerVisibleBanksFn } from "@/lib/partners/partner-catalog.server";

export const Route = createFileRoute("/app/parceiros/bancos")({
  loader: async () => {
    const banks = await listPartnerVisibleBanksFn();
    return { banks };
  },
  staleTime: 10_000,
  component: PartnerBanksPage,
});

function PartnerBanksPage() {
  const { banks } = Route.useLoaderData();
  return <PartnerBanksCatalogScreen initialBanks={banks} />;
}
