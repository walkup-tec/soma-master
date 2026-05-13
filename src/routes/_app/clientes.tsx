import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_app/clientes")({
  component: () => (
    <ComingSoon
      title="CRM de Clientes"
      description="Kanban + tabela com filtros avançados, tags coloridas e drawer de detalhes. Próximo deploy."
    />
  ),
});
