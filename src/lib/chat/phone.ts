/** Normaliza telefone BR/WhatsApp para match (somente dígitos, com DDI 55 quando 10–11 dígitos). */

export function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

export function normalizeWhatsAppPhone(value: string): string {
  let digits = digitsOnly(value);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  return digits;
}

export function phonesMatch(a: string, b: string): boolean {
  const left = normalizeWhatsAppPhone(a);
  const right = normalizeWhatsAppPhone(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const trim = (p: string) => (p.startsWith("55") && p.length > 12 ? p.slice(0, 4) + p.slice(5) : p);
  return trim(left) === trim(right) || left.endsWith(right.slice(-10)) || right.endsWith(left.slice(-10));
}
