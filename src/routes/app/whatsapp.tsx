import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/app/whatsapp")({
  component: () => (
    <ComingSoon title="WhatsApp" description="Central de atendimento estilo Kommo com multiatendimento e templates." />
  ),
});
