import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_app/remarketing")({
  component: () => (
    <ComingSoon title="Remarketing" description="Lista priorizada, timeline de contatos, disparo em massa e WhatsApp." />
  ),
});
