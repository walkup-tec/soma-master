import { cpfDigits, maskCpf } from "@/lib/masks/br-cpf";
import { cnpjDigits, maskCnpj } from "@/lib/masks/br-cnpj";

export type TaxIdKind = "cpf" | "cnpj";

/** Aplica máscara de CPF ou CNPJ conforme o tipo de pessoa. */
export function maskTaxId(value: string, kind: TaxIdKind): string {
  return kind === "cpf" ? maskCpf(value) : maskCnpj(value);
}

export function taxIdDigits(value: string, kind: TaxIdKind): string {
  return kind === "cpf" ? cpfDigits(value) : cnpjDigits(value);
}
