/** Mantém apenas dígitos (máx. 8 para ddmmaaaa). */
export function digitsOnlyDate(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

/** Aplica máscara dd/mm/aaaa enquanto o usuário digita. */
export function maskDateBr(value: string): string {
  const digits = digitsOnlyDate(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Valida data calendário no formato dd/mm/aaaa (opcionalmente incompleta). */
export function isCompleteDateBr(value: string): boolean {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return false;
  }
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Converte dd/mm/aaaa válido para YYYY-MM-DD. */
export function dateBrToIso(value: string): string | null {
  if (!isCompleteDateBr(value)) return null;
  const [day, month, year] = value.trim().split("/");
  return `${year}-${month}-${day}`;
}
