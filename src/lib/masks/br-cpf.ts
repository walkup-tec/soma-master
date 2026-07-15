/** Mantém só dígitos do CPF (máx. 11). */
export function cpfDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/** Máscara: 000.000.000-00 */
export function maskCpf(value: string): string {
  const digits = cpfDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function isCompleteCpf(value: string): boolean {
  return cpfDigits(value).length === 11;
}
