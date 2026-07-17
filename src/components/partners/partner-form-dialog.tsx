import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Save, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MENU_ITEMS, MENU_SECTIONS, type MenuItemId } from "@/lib/config/menu-items";
import { BRAZIL_UFS } from "@/lib/geo/brazil-ufs";
import { maskCep, isCompleteCep } from "@/lib/masks/br-cep";
import { isCompleteCpf, maskCpf } from "@/lib/masks/br-cpf";
import { isCompleteCnpj } from "@/lib/masks/br-cnpj";
import { isCompletePhoneBr, maskPhoneBr } from "@/lib/masks/br-phone";
import { maskTaxId } from "@/lib/masks/br-tax-id";
import { isFilledValidEmail } from "@/lib/masks/email";
import {
  PARTNER_BANKS,
  PARTNER_CATEGORIES,
  PARTNER_PERSON_TYPES,
  PARTNER_PIX_KEY_TYPES,
} from "@/lib/partners/partner.constants";
import {
  createPartnerFn,
  lookupPartnerCepFn,
  updatePartnerFn,
} from "@/lib/partners/partners.server";
import type {
  PartnerCategory,
  PartnerPersonType,
  PartnerPixKeyType,
  PartnerRecord,
  PartnerUpsertInput,
} from "@/lib/partners/partner.types";
import { cn } from "@/lib/utils";

type PartnerFormState = PartnerUpsertInput & { password: string };

function emptyForm(allowedMenuIds: MenuItemId[]): PartnerFormState {
  return {
    category: "substabelecido",
    personType: "pf",
    name: "",
    taxId: "",
    rg: "",
    email: "",
    password: "",
    phone: "",
    whatsapp: "",
    pixKeyType: "cpf",
    pixKey: "",
    cep: "",
    street: "",
    neighborhood: "",
    city: "",
    state: "",
    complement: "",
    number: "",
    menuIds: allowedMenuIds.includes("parceiros") ? ["parceiros"] : [],
    canCreatePartners: false,
    bankIds: [],
  };
}

function maskPixKey(type: PartnerPixKeyType, value: string): string {
  if (type === "cpf") return maskCpf(value);
  if (type === "phone") return maskPhoneBr(value);
  if (type === "email") return value.trimStart();
  return value.slice(0, 180);
}

function formFromPartner(partner: PartnerRecord): PartnerFormState {
  return {
    category: partner.category,
    personType: partner.personType,
    name: partner.name,
    taxId: maskTaxId(partner.taxId, partner.personType === "pf" ? "cpf" : "cnpj"),
    rg: partner.rg,
    email: partner.email,
    password: "",
    phone: maskPhoneBr(partner.phone),
    whatsapp: maskPhoneBr(partner.whatsapp),
    pixKeyType: partner.pixKeyType,
    pixKey: maskPixKey(partner.pixKeyType, partner.pixKey),
    cep: maskCep(partner.cep),
    street: partner.street,
    neighborhood: partner.neighborhood,
    city: partner.city,
    state: partner.state,
    complement: partner.complement,
    number: partner.number,
    menuIds: partner.menuIds,
    canCreatePartners: partner.canCreatePartners,
    bankIds: partner.bankIds,
  };
}

function RequiredLabel({
  htmlFor,
  children,
  optional = false,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      {optional ? (
        <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
      ) : (
        <span className="ml-0.5 text-destructive" aria-hidden>
          *
        </span>
      )}
    </Label>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  optional = false,
  className,
  ...props
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  optional?: boolean;
  className?: string;
} & Omit<React.ComponentProps<typeof Input>, "id" | "value" | "onChange" | "className">) {
  return (
    <div className={cn("space-y-2", className)}>
      <RequiredLabel htmlFor={id} optional={optional}>
        {label}
      </RequiredLabel>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={cn(error && "border-destructive focus-visible:ring-destructive")}
        {...props}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function validateClientForm(
  form: PartnerFormState,
  isEditing: boolean,
): Partial<Record<keyof PartnerFormState | "banks" | "menus", string>> {
  const errors: Partial<Record<keyof PartnerFormState | "banks" | "menus", string>> = {};

  if (form.name.trim().length < 3) {
    errors.name = "Informe o nome completo ou razão social.";
  }
  if (form.personType === "pf" && !isCompleteCpf(form.taxId)) {
    errors.taxId = "Informe um CPF completo.";
  }
  if (form.personType === "pj" && !isCompleteCnpj(form.taxId)) {
    errors.taxId = "Informe um CNPJ completo.";
  }
  if (form.personType === "pf" && !form.rg.trim()) {
    errors.rg = "Informe o RG.";
  }
  if (!isFilledValidEmail(form.email)) {
    errors.email = "Informe um e-mail válido.";
  }
  if (!isEditing && form.password.length < 8) {
    errors.password = "A senha deve ter ao menos 8 caracteres.";
  }
  if (isEditing && form.password && form.password.length < 8) {
    errors.password = "A nova senha deve ter ao menos 8 caracteres.";
  }
  if (!isCompletePhoneBr(form.phone)) {
    errors.phone = "Informe um telefone válido com DDD.";
  }
  if (!isCompletePhoneBr(form.whatsapp)) {
    errors.whatsapp = "Informe um WhatsApp válido com DDD.";
  }
  if (form.pixKeyType === "cpf" && !isCompleteCpf(form.pixKey)) {
    errors.pixKey = "Informe uma chave PIX de CPF completa.";
  } else if (form.pixKeyType === "phone" && !isCompletePhoneBr(form.pixKey)) {
    errors.pixKey = "Informe uma chave PIX de telefone válida.";
  } else if (form.pixKeyType === "email" && !isFilledValidEmail(form.pixKey)) {
    errors.pixKey = "Informe uma chave PIX de e-mail válida.";
  } else if (form.pixKeyType === "random" && form.pixKey.trim().length < 8) {
    errors.pixKey = "Informe a chave PIX aleatória.";
  }
  if (!isCompleteCep(form.cep)) {
    errors.cep = "Informe um CEP válido.";
  }
  if (!form.street.trim()) errors.street = "Informe o endereço.";
  if (!form.number.trim()) errors.number = "Informe o número.";
  if (!form.neighborhood.trim()) errors.neighborhood = "Informe o bairro.";
  if (!form.city.trim()) errors.city = "Informe a cidade.";
  if (!form.state) errors.state = "Selecione o estado.";
  if (form.bankIds.length === 0) errors.banks = "Selecione ao menos um banco.";
  if (form.menuIds.length === 0) errors.menus = "Selecione ao menos um menu.";

  return errors;
}

export function PartnerFormDialog({
  open,
  partner,
  allowedMenuIds,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  partner: PartnerRecord | null;
  allowedMenuIds: MenuItemId[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
}) {
  const createPartner = useServerFn(createPartnerFn);
  const updatePartner = useServerFn(updatePartnerFn);
  const lookupCep = useServerFn(lookupPartnerCepFn);
  const [form, setForm] = useState<PartnerFormState>(() => emptyForm(allowedMenuIds));
  const [saving, setSaving] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [touchedSubmit, setTouchedSubmit] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(partner ? formFromPartner(partner) : emptyForm(allowedMenuIds));
    setTouchedSubmit(false);
  }, [allowedMenuIds, open, partner]);

  const grantableMenus = useMemo(
    () => MENU_ITEMS.filter((item) => allowedMenuIds.includes(item.id)),
    [allowedMenuIds],
  );

  const fieldErrors = useMemo(
    () => (touchedSubmit ? validateClientForm(form, Boolean(partner)) : {}),
    [form, partner, touchedSubmit],
  );

  const emailInvalid = Boolean(form.email.trim()) && !isFilledValidEmail(form.email);
  const pixEmailInvalid =
    form.pixKeyType === "email" && Boolean(form.pixKey.trim()) && !isFilledValidEmail(form.pixKey);

  const update = <K extends keyof PartnerFormState>(key: K, value: PartnerFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleMenu = (menuId: MenuItemId) => {
    const menuIds = form.menuIds.includes(menuId)
      ? form.menuIds.filter((id) => id !== menuId)
      : [...form.menuIds, menuId];
    update("menuIds", menuIds);
    if (menuId === "parceiros" && !menuIds.includes("parceiros")) {
      update("canCreatePartners", false);
    }
  };

  const toggleBank = (bankId: string) => {
    update(
      "bankIds",
      form.bankIds.includes(bankId)
        ? form.bankIds.filter((id) => id !== bankId)
        : [...form.bankIds, bankId],
    );
  };

  const handlePersonTypeChange = (value: PartnerPersonType) => {
    setForm((current) => ({
      ...current,
      personType: value,
      taxId: maskTaxId(current.taxId, value === "pf" ? "cpf" : "cnpj"),
      rg: value === "pf" ? current.rg : "",
    }));
  };

  const handlePixTypeChange = (value: PartnerPixKeyType) => {
    setForm((current) => ({
      ...current,
      pixKeyType: value,
      pixKey: maskPixKey(value, current.pixKey),
    }));
  };

  const handleLookupCep = async () => {
    if (!isCompleteCep(form.cep)) {
      toast.error("Informe um CEP válido com 8 dígitos.");
      return;
    }
    setLookingUpCep(true);
    try {
      const address = await lookupCep({ data: { cep: form.cep } });
      setForm((current) => ({
        ...current,
        cep: maskCep(address.cep),
        street: address.street || current.street,
        neighborhood: address.neighborhood || current.neighborhood,
        city: address.city || current.city,
        state: address.state || current.state,
        complement: current.complement || address.complement,
      }));
      toast.success("Endereço localizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar o CEP.");
    } finally {
      setLookingUpCep(false);
    }
  };

  const handleSubmit = async () => {
    setTouchedSubmit(true);
    const errors = validateClientForm(form, Boolean(partner));
    const firstError = Object.values(errors)[0];
    if (firstError) {
      toast.error(firstError);
      return;
    }

    setSaving(true);
    try {
      const data = { ...form, password: form.password || undefined };
      if (partner) {
        await updatePartner({ data: { ...data, partnerId: partner.id } });
        toast.success("Parceiro atualizado.");
      } else {
        await createPartner({ data });
        toast.success("Parceiro criado com sucesso.");
      }
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o parceiro.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-y-auto">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <UserRoundPlus className="size-5 text-primary" />
            {partner ? "Editar parceiro" : "Novo parceiro"}
          </DialogTitle>
          <DialogDescription>
            Campos marcados com * são obrigatórios. O responsável será quem criou o cadastro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-border/60 p-4">
            <h3 className="font-display text-sm font-semibold">Identificação</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel>Categoria</RequiredLabel>
                <Select
                  value={form.category}
                  onValueChange={(value) => update("category", value as PartnerCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTNER_CATEGORIES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <RequiredLabel>Tipo de pessoa</RequiredLabel>
                <Select value={form.personType} onValueChange={handlePersonTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTNER_PERSON_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                id="partner-name"
                label={form.personType === "pf" ? "Nome completo" : "Razão social"}
                value={form.name}
                onChange={(value) => update("name", value)}
                error={fieldErrors.name}
                className="sm:col-span-2"
                autoComplete="name"
                required
              />
              <Field
                id="partner-tax-id"
                label={form.personType === "pf" ? "CPF" : "CNPJ"}
                value={form.taxId}
                onChange={(value) =>
                  update("taxId", maskTaxId(value, form.personType === "pf" ? "cpf" : "cnpj"))
                }
                error={fieldErrors.taxId}
                inputMode="numeric"
                autoComplete="off"
                placeholder={form.personType === "pf" ? "000.000.000-00" : "00.000.000/0000-00"}
                maxLength={form.personType === "pf" ? 14 : 18}
                required
              />
              {form.personType === "pf" ? (
                <Field
                  id="partner-rg"
                  label="RG"
                  value={form.rg}
                  onChange={(value) => update("rg", value.slice(0, 30))}
                  error={fieldErrors.rg}
                  required
                />
              ) : (
                <div />
              )}
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border/60 p-4">
            <h3 className="font-display text-sm font-semibold">Acesso e contato</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel htmlFor="partner-email">E-mail</RequiredLabel>
                <Input
                  id="partner-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="nome@exemplo.com"
                  value={form.email}
                  required
                  aria-invalid={emailInvalid || Boolean(fieldErrors.email)}
                  className={cn(
                    (emailInvalid || fieldErrors.email) &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                  onChange={(event) => update("email", event.target.value.trimStart())}
                />
                {emailInvalid || fieldErrors.email ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.email ?? "Informe um e-mail válido."}
                  </p>
                ) : null}
              </div>
              <Field
                id="partner-password"
                label={partner ? "Nova senha" : "Senha"}
                type="password"
                value={form.password}
                onChange={(value) => update("password", value)}
                error={fieldErrors.password}
                optional={Boolean(partner)}
                placeholder={
                  partner ? "Deixe em branco para manter a atual" : "Mínimo 8 caracteres"
                }
                autoComplete={partner ? "new-password" : "new-password"}
                required={!partner}
              />
              <Field
                id="partner-phone"
                label="Telefone"
                value={form.phone}
                onChange={(value) => update("phone", maskPhoneBr(value))}
                error={fieldErrors.phone}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
                maxLength={15}
                required
              />
              <Field
                id="partner-whatsapp"
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(value) => update("whatsapp", maskPhoneBr(value))}
                error={fieldErrors.whatsapp}
                inputMode="tel"
                placeholder="(00) 00000-0000"
                maxLength={15}
                required
              />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border/60 p-4">
            <h3 className="font-display text-sm font-semibold">Dados PIX</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel>Tipo de chave</RequiredLabel>
                <Select value={form.pixKeyType} onValueChange={handlePixTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTNER_PIX_KEY_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="partner-pix-key">Chave PIX</RequiredLabel>
                <Input
                  id="partner-pix-key"
                  value={form.pixKey}
                  required
                  inputMode={
                    form.pixKeyType === "email"
                      ? "email"
                      : form.pixKeyType === "random"
                        ? "text"
                        : "numeric"
                  }
                  placeholder={
                    form.pixKeyType === "cpf"
                      ? "000.000.000-00"
                      : form.pixKeyType === "phone"
                        ? "(00) 00000-0000"
                        : form.pixKeyType === "email"
                          ? "nome@exemplo.com"
                          : "Chave aleatória"
                  }
                  maxLength={
                    form.pixKeyType === "cpf" ? 14 : form.pixKeyType === "phone" ? 15 : 180
                  }
                  aria-invalid={pixEmailInvalid || Boolean(fieldErrors.pixKey)}
                  className={cn(
                    (pixEmailInvalid || fieldErrors.pixKey) &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                  onChange={(event) =>
                    update("pixKey", maskPixKey(form.pixKeyType, event.target.value))
                  }
                />
                {pixEmailInvalid || fieldErrors.pixKey ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.pixKey ?? "Informe uma chave PIX de e-mail válida."}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border/60 p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
              <MapPin className="size-4 text-primary" /> Endereço
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <RequiredLabel htmlFor="partner-cep">CEP</RequiredLabel>
                <div className="flex gap-2">
                  <Input
                    id="partner-cep"
                    value={form.cep}
                    onChange={(event) => update("cep", maskCep(event.target.value))}
                    inputMode="numeric"
                    placeholder="00000-000"
                    maxLength={9}
                    required
                    aria-invalid={Boolean(fieldErrors.cep)}
                    className={cn(
                      fieldErrors.cep && "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={lookingUpCep}
                    onClick={handleLookupCep}
                  >
                    {lookingUpCep ? <Loader2 className="size-4 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
                {fieldErrors.cep ? (
                  <p className="text-xs text-destructive">{fieldErrors.cep}</p>
                ) : null}
              </div>
              <Field
                id="partner-street"
                label="Endereço"
                value={form.street}
                onChange={(value) => update("street", value)}
                error={fieldErrors.street}
                className="lg:col-span-2"
                autoComplete="street-address"
                required
              />
              <Field
                id="partner-number"
                label="Número"
                value={form.number}
                onChange={(value) => update("number", value)}
                error={fieldErrors.number}
                required
              />
              <Field
                id="partner-complement"
                label="Complemento"
                value={form.complement}
                onChange={(value) => update("complement", value)}
                optional
              />
              <Field
                id="partner-neighborhood"
                label="Bairro"
                value={form.neighborhood}
                onChange={(value) => update("neighborhood", value)}
                error={fieldErrors.neighborhood}
                required
              />
              <Field
                id="partner-city"
                label="Cidade"
                value={form.city}
                onChange={(value) => update("city", value)}
                error={fieldErrors.city}
                required
              />
              <div className="space-y-2">
                <RequiredLabel>Estado (UF)</RequiredLabel>
                <Select
                  value={form.state || undefined}
                  onValueChange={(value) => update("state", value)}
                >
                  <SelectTrigger
                    aria-invalid={Boolean(fieldErrors.state)}
                    className={cn(
                      fieldErrors.state && "border-destructive focus-visible:ring-destructive",
                    )}
                  >
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZIL_UFS.map((uf) => (
                      <SelectItem key={uf.code} value={uf.code}>
                        {uf.code} — {uf.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.state ? (
                  <p className="text-xs text-destructive">{fieldErrors.state}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border/60 p-4">
            <div>
              <h3 className="font-display text-sm font-semibold">
                Bancos de atuação
                <span className="ml-0.5 text-destructive" aria-hidden>
                  *
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">Selecione ao menos um banco.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PARTNER_BANKS.map((bank) => (
                <label
                  key={bank.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 p-3 text-sm"
                >
                  <Checkbox
                    checked={form.bankIds.includes(bank.id)}
                    onCheckedChange={() => toggleBank(bank.id)}
                  />
                  {bank.name}
                </label>
              ))}
            </div>
            {fieldErrors.banks ? (
              <p className="text-xs text-destructive">{fieldErrors.banks}</p>
            ) : null}
          </section>

          <section className="space-y-4 rounded-xl border border-border/60 p-4">
            <div>
              <h3 className="font-display text-sm font-semibold">
                Menus e permissões
                <span className="ml-0.5 text-destructive" aria-hidden>
                  *
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Selecione ao menos um menu. Você só pode conceder acessos que também possui.
              </p>
            </div>
            <div className="space-y-4">
              {MENU_SECTIONS.map((section) => {
                const items = grantableMenus.filter((item) => item.section === section.id);
                if (items.length === 0) return null;
                return (
                  <div key={section.id} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.label}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((item) => (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 p-3 text-sm"
                        >
                          <Checkbox
                            checked={form.menuIds.includes(item.id)}
                            onCheckedChange={() => toggleMenu(item.id)}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {fieldErrors.menus ? (
                <p className="text-xs text-destructive">{fieldErrors.menus}</p>
              ) : null}
              {allowedMenuIds.includes("parceiros") ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <Checkbox
                    checked={form.canCreatePartners}
                    disabled={!form.menuIds.includes("parceiros")}
                    onCheckedChange={(checked) => update("canCreatePartners", checked === true)}
                  />
                  <span>
                    <span className="block font-medium">Cadastrar parceiros abaixo dele</span>
                    <span className="block text-xs text-muted-foreground">
                      O novo cadastro terá este parceiro como responsável fixo.
                    </span>
                  </span>
                </label>
              ) : null}
            </div>
          </section>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={saving} onClick={handleSubmit}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {partner ? "Salvar alterações" : "Criar parceiro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
