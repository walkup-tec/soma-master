export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function whatsappHref(value: string): string | null {
  const digits = phoneDigits(value);
  if (digits.length < 10) return null;
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}`;
}

export function phoneHref(value: string): string | null {
  const digits = phoneDigits(value);
  if (digits.length < 10) return null;
  return `tel:+${digits.startsWith("55") ? digits : `55${digits}`}`;
}
