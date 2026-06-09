import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/app/documentos")({
  component: () => (
    <ComingSoon title="Documentos" description="Upload drag-and-drop com preview, categorias e histórico." />
  ),
});
