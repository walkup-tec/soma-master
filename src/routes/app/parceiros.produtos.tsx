import { createFileRoute } from "@tanstack/react-router";
import { PartnerProductsCatalogScreen } from "@/components/partners/partner-products-catalog-screen";

export const Route = createFileRoute("/app/parceiros/produtos")({
  component: PartnerProductsPage,
});

function PartnerProductsPage() {
  return <PartnerProductsCatalogScreen />;
}
