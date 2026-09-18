import { createFileRoute } from "@tanstack/react-router";

/**
 * Muda a cada boot do processo — o front usa para detectar que o novo deploy
 * subiu (drift de boot id) e recarregar a tela com segurança.
 */
const SERVER_BOOT_ID = crypto.randomUUID();
const SOMA_SERVICE_ID = "soma-gestao-interno";

let shuttingDown = false;

function markSomaShuttingDown() {
  shuttingDown = true;
}

if (typeof process !== "undefined" && typeof process.once === "function") {
  process.once("SIGTERM", markSomaShuttingDown);
  process.once("SIGINT", markSomaShuttingDown);
}

/** Liveness para healthcheck Easypanel/Traefik — sem auth e sem DB. */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          {
            ok: !shuttingDown,
            shuttingDown,
            service: SOMA_SERVICE_ID,
            projectId: SOMA_SERVICE_ID,
            serverBootId: SERVER_BOOT_ID,
          },
          {
            status: shuttingDown ? 503 : 200,
            headers: { "Cache-Control": "no-store" },
          },
        ),
    },
  },
});
