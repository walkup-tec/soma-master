import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/app/propostas")({
  component: () => (
    <ComingSoon title="Propostas" description="Lista premium de propostas com filtros por banco, status e produto." />
  ),
});
