/** Mantém só dígitos (centavos), até 15. */
export function currencyDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 15);
}

/** Máscara BRL enquanto digita: R$ 1.234,56 */
export function maskCurrencyBrl(value: string): string {
  const digits = currencyDigits(value);
  if (!digits) return "";
  const amount = Number(digits) / 100;
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
