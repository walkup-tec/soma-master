import { createFileRoute, redirect } from "@tanstack/react-router";

/** Educação da IA vive em Configurações → Integração EVO. */
export const Route = createFileRoute("/app/chat/ia")({
  beforeLoad: () => {
    throw redirect({
      to: "/app/configuracoes",
      search: { tab: "chatbot" },
    });
  },
  component: () => null,
});
