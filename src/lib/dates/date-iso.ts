/** Converte YYYY-MM-DD para Date local (sem desvio UTC). */
export function isoToLocalDate(iso: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return undefined;
  const [year, month, day] = iso.trim().split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

/** Converte Date local para YYYY-MM-DD. */
export function localDateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
