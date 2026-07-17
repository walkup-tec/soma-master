/** Mantém só dígitos do CEP (máx. 8). */
export function cepDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

/** Máscara: 00000-000 */
export function maskCep(value: string): string {
  const digits = cepDigits(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function isCompleteCep(value: string): boolean {
  return cepDigits(value).length === 8;
}
