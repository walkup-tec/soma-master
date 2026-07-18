import { createFileRoute } from "@tanstack/react-router";
import { PartnerTablesScreen } from "@/components/partners/partner-tables-screen";
import {
  listPartnerCommissionTablesFn,
  listPartnerProductBankRowsForTablesFn,
  listPartnersForTablesFn,
} from "@/lib/partners/partner-catalog.server";

export const Route = createFileRoute("/app/parceiros/tabelas")({
  loader: async () => {
    const [rows, tables, partners] = await Promise.all([
      listPartnerProductBankRowsForTablesFn(),
      listPartnerCommissionTablesFn(),
      listPartnersForTablesFn(),
    ]);
    return { rows, tables, partners };
  },
  staleTime: 10_000,
  component: PartnerTablesPage,
});

function PartnerTablesPage() {
  const { rows, tables, partners } = Route.useLoaderData();
  return (
    <PartnerTablesScreen initialRows={rows} initialTables={tables} initialPartners={partners} />
  );
}
