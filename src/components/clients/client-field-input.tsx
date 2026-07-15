import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClientFieldId } from "@/lib/config/client-fields";
import type { BankConfig } from "@/lib/config/settings-types";
import { maskDateBr } from "@/lib/dates/date-mask";
import { BRAZIL_UFS } from "@/lib/geo/brazil-ufs";
import { maskCurrencyBrl } from "@/lib/masks/br-currency";
import { maskCpf } from "@/lib/masks/br-cpf";
import { maskPhoneBr } from "@/lib/masks/br-phone";
import { isValidEmail } from "@/lib/masks/email";
import { cn } from "@/lib/utils";

type Props = {
  fieldId: ClientFieldId;
  value: string;
  onChange: (value: string) => void;
  banks: BankConfig[];
  id?: string;
  required?: boolean;
};

const DATE_FIELD_IDS = new Set<ClientFieldId>(["data_nascimento", "data_ultima_parcela"]);
const PHONE_FIELD_IDS = new Set<ClientFieldId>(["telefone", "whatsapp"]);
const CURRENCY_FIELD_IDS = new Set<ClientFieldId>([
  "renda_mensal",
  "valor_desejado",
  "valor_liberado",
  "margem_disponivel",
]);

export function ClientFieldInput({ fieldId, value, onChange, banks, id, required }: Props) {
  if (fieldId === "banco" && banks.length > 0) {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Selecione o banco" />
        </SelectTrigger>
        <SelectContent>
          {banks.map((bank) => (
            <SelectItem key={bank.id} value={bank.name}>
              {bank.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (fieldId === "banco") {
    return (
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Cadastre bancos em Configurações"
        required={required}
      />
    );
  }

  if (fieldId === "uf") {
    return (
      <Select
        value={value || undefined}
        onValueChange={(next) => onChange(next)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Selecione a UF" />
        </SelectTrigger>
        <SelectContent>
          {BRAZIL_UFS.map((uf) => (
            <SelectItem key={uf.code} value={uf.code}>
              {uf.code} — {uf.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (DATE_FIELD_IDS.has(fieldId)) {
    return (
      <Input
        id={id}
        value={value}
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        required={required}
        onChange={(event) => onChange(maskDateBr(event.target.value))}
      />
    );
  }

  if (fieldId === "cpf") {
    return (
      <Input
        id={id}
        value={value}
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00"
        maxLength={14}
        required={required}
        onChange={(event) => onChange(maskCpf(event.target.value))}
      />
    );
  }

  if (PHONE_FIELD_IDS.has(fieldId)) {
    return (
      <Input
        id={id}
        value={value}
        inputMode="tel"
        autoComplete="tel"
        placeholder="(00) 00000-0000"
        maxLength={15}
        required={required}
        onChange={(event) => onChange(maskPhoneBr(event.target.value))}
      />
    );
  }

  if (CURRENCY_FIELD_IDS.has(fieldId)) {
    return (
      <Input
        id={id}
        value={value}
        inputMode="numeric"
        autoComplete="off"
        placeholder="R$ 0,00"
        required={required}
        onChange={(event) => onChange(maskCurrencyBrl(event.target.value))}
      />
    );
  }

  if (fieldId === "email") {
    const invalid = Boolean(value.trim()) && !isValidEmail(value);
    return (
      <div className="space-y-1">
        <Input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value}
          required={required}
          placeholder="nome@exemplo.com"
          aria-invalid={invalid}
          className={cn(invalid && "border-destructive focus-visible:ring-destructive")}
          onChange={(event) => onChange(event.target.value.trimStart())}
        />
        {invalid ? (
          <p className="text-xs text-destructive">Informe um e-mail válido.</p>
        ) : null}
      </div>
    );
  }

  return (
    <Input
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
    />
  );
}
