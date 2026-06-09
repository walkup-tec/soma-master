import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/app/relatorios")({
  component: () => (
    <ComingSoon title="Relatórios" description="Gráficos, rankings e indicadores de performance." />
  ),
});
