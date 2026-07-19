import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout pai — lista em index; Bancos/Produtos/Tabelas/Solicitação Usuário em rotas filhas. */
export const Route = createFileRoute("/app/parceiros")({
  component: ParceirosLayout,
});

function ParceirosLayout() {
  return <Outlet />;
}
