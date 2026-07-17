import { createFileRoute } from "@tanstack/react-router";

/**
 * Muda a cada boot do processo — o front usa para detectar que o novo deploy
 * subiu (drift de boot id) e recarregar a tela com segurança.
 */
const SERVER_BOOT_ID = crypto.randomUUID();

/** Liveness para healthcheck Easypanel/Traefik — sem auth e sem DB. */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          {
            ok: true,
            service: "soma-gestao-interno",
            serverBootId: SERVER_BOOT_ID,
          },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
