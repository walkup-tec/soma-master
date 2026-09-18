import { createFileRoute } from "@tanstack/react-router";

/**
 * Identidade do processo — o front detecta redeploy do gestao-interno
 * (drift de boot id / shuttingDown) e mostra o modal de atualização.
 *
 * O UUID vive em globalThis (preenchido no docker-start) para não ser
 * congelado em build pelo bundler. Fallback: UUID no load do módulo.
 */
const SOMA_SERVICE_ID = "soma-gestao-interno";
const MODULE_BOOT_ID = crypto.randomUUID();

let shuttingDown = false;

type SomaRuntimeGlobals = {
  __SOMA_SERVER_BOOT_ID?: string;
  __SOMA_SHUTTING_DOWN?: boolean;
};

function runtime(): SomaRuntimeGlobals {
  return globalThis as SomaRuntimeGlobals;
}

function readBootId(): string {
  return String(runtime().__SOMA_SERVER_BOOT_ID || MODULE_BOOT_ID);
}

function readShuttingDown(): boolean {
  return Boolean(runtime().__SOMA_SHUTTING_DOWN) || shuttingDown;
}

function markSomaShuttingDown() {
  shuttingDown = true;
  runtime().__SOMA_SHUTTING_DOWN = true;
}

if (typeof process !== "undefined" && typeof process.on === "function") {
  process.on("SIGTERM", markSomaShuttingDown);
  process.on("SIGINT", markSomaShuttingDown);
}

/** Liveness para healthcheck Easypanel/Traefik — sem auth e sem DB. */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const down = readShuttingDown();
        return Response.json(
          {
            ok: !down,
            shuttingDown: down,
            service: SOMA_SERVICE_ID,
            projectId: SOMA_SERVICE_ID,
            serverBootId: readBootId(),
          },
          {
            status: down ? 503 : 200,
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
