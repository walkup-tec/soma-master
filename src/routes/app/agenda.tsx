import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/app/agenda")({
  component: () => (
    <ComingSoon title="Agenda & Follow-up" description="Calendário, lista do dia e timeline de retornos e pós-venda." />
  ),
});
