import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/app/clientes/novo")({
  component: () => (
    <ComingSoon
      title="Cadastro de Cliente"
      description="Wizard com 5 abas: Dados pessoais, Endereço, Financeiro, Produto e Uploads."
    />
  ),
});
