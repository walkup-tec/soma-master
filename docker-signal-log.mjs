/**
 * Carregado com `node --import` antes do Nitro/srvx.
 * Quando o Easypanel/Swarm manda SIGTERM, o srvx imprime "Server closed successfully"
 * sem dizer a causa — estes logs deixam isso explícito.
 */
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(signal, () => {
    console.error(
      `soma-signal: received ${signal} (orquestrador/healthcheck costuma matar se a porta do app ≠ porta do domínio)`,
    );
  });
}

process.on("exit", (code) => {
  console.error(`soma-signal: process exit code=${code}`);
});
