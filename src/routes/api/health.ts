import { createFileRoute } from "@tanstack/react-router";

/** Liveness para healthcheck Easypanel/Traefik — sem auth e sem DB. */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { ok: true, service: "soma-gestao-interno" },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
