import { createFileRoute } from "@tanstack/react-router";
import { PartnerUserRequestsScreen } from "@/components/partners/partner-user-requests-screen";
import { EMPTY_PARTNER_USER_REQUESTS } from "@/lib/partners/partner-user-request.types";

export const Route = createFileRoute("/app/parceiros/solicitacao-usuario")({
  component: PartnerUserRequestsPage,
});

function PartnerUserRequestsPage() {
  return <PartnerUserRequestsScreen rows={EMPTY_PARTNER_USER_REQUESTS} />;
}
