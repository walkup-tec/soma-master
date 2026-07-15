export class ImportLimitReachedError extends Error {
  readonly imported: number;

  constructor(imported: number) {
    super(`Limite de clientes atingido após ${imported.toLocaleString("pt-BR")} registro(s).`);
    this.name = "ImportLimitReachedError";
    this.imported = imported;
  }
}
