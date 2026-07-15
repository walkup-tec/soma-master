/** E-mail vazio é válido (campo opcional); preenchido exige formato. */
export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(trimmed);
}
