/** Mantém só dígitos do CNPJ (máx. 14). */
export function cnpjDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14);
}

/** Máscara: 00.000.000/0000-00 */
export function maskCnpj(value: string): string {
  const digits = cnpjDigits(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function isCompleteCnpj(value: string): boolean {
  return cnpjDigits(value).length === 14;
}
