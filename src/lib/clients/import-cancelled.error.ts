export class ImportCancelledError extends Error {
  readonly imported: number;

  constructor(imported: number) {
    super("Importação cancelada pelo usuário.");
    this.name = "ImportCancelledError";
    this.imported = imported;
  }
}
