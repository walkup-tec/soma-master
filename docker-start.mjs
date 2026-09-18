/**
 * Arranque Nitro com sinal de redeploy visível no /api/health.
 *
 * Easypanel/Docker mandam SIGTERM no Redeploy. Sem listener o processo
 * morre na hora; COM listener vazio o Node NÃO sai (default é cancelado)
 * e o Traefik passa a devolver 502 — o browser nunca vê shuttingDown.
 * Aqui marcamos o drain, o health responde 503 por alguns segundos, e
 * só então o processo encerra.
 */
const bootId = crypto.randomUUID();
globalThis.__SOMA_SERVER_BOOT_ID = bootId;
globalThis.__SOMA_SHUTTING_DOWN = false;

const DRAIN_MS = 4_000;
let exiting = false;

function requestShutdown(signal) {
  if (exiting) return;
  exiting = true;
  globalThis.__SOMA_SHUTTING_DOWN = true;
  console.error(
    `soma-signal: received ${signal} — drain ${DRAIN_MS}ms (Redeploy gestao-interno / orquestrador)`,
  );
  setTimeout(() => {
    console.error("soma-signal: drain finished, exiting");
    process.exit(0);
  }, DRAIN_MS);
}

for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(signal, () => requestShutdown(signal));
}

process.on("exit", (code) => {
  console.error(`soma-signal: process exit code=${code}`);
});

process.on("uncaughtException", (err) => {
  console.error("soma-start: uncaughtException", err);
  process.exit(1);
});

console.log(
  `soma-start: loading Nitro PORT=${process.env.PORT ?? ""} HOST=${process.env.HOST ?? ""} bootId=${bootId}`,
);

await import("./.output/server/index.mjs");
