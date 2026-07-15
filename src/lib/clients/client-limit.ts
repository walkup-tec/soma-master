/**
 * Teto opcional da base de clientes.
 * `null` = sem limite (importação e cadastro aceitam qualquer quantidade).
 */
export const CLIENT_DATABASE_LIMIT: number | null = null;

export function hasClientDatabaseLimit(): boolean {
  return typeof CLIENT_DATABASE_LIMIT === "number" && CLIENT_DATABASE_LIMIT > 0;
}
