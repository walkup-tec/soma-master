import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_app/configuracoes")({
  component: () => (
    <ComingSoon title="Configurações" description="Usuários, permissões, bancos parceiros, produtos, tags e integrações." />
  ),
});
