/**
 * Arranque Nitro com log de sinais (SIGTERM = healthcheck/porta/orquestrador).
 * Evita `node --import` (mais frágil no PATH do container).
 */
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(signal, () => {
    console.error(
      `soma-signal: received ${signal} — Easypanel/Docker a parar o container (redeploy, porta proxy≠${process.env.PORT || "3000"}, ou healthcheck)`,
    );
  });
}

process.on("exit", (code) => {
  console.error(`soma-signal: process exit code=${code}`);
});

process.on("uncaughtException", (err) => {
  console.error("soma-start: uncaughtException", err);
  process.exit(1);
});

console.log(
  `soma-start: loading Nitro PORT=${process.env.PORT ?? ""} HOST=${process.env.HOST ?? ""}`,
);

await import("./.output/server/index.mjs");
