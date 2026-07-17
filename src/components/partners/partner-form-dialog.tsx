import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Copy, KeyRound, Loader2, MapPin, Save, UserRoundPlus } from "lucide-react";
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
import {
  MENU_ITEMS,
  MENU_SECTIONS,
  type MenuItemId,
  type MenuSectionId,
} from "@/lib/config/menu-items";
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
  partnerCategoryAlias,
} from "@/lib/partners/partner.constants";
import {
  createPartnerFn,
  lookupPartnerCnpjFn,
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
    menuIds: [],
    canCreatePartners: false,
    bankIds: [],
  };
}

function sectionsFromMenuIds(menuIds: MenuItemId[]): MenuSectionId[] {
  const selected = new Set(menuIds);
  return MENU_SECTIONS.filter((section) =>
    MENU_ITEMS.some((item) => item.section === section.id && selected.has(item.id)),
  ).map((section) => section.id);
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
  originalCategory?: PartnerCategory,
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
  if (!isEditing && !/^\d{4}$/.test(form.password)) {
    errors.password = "Informe exatamente 4 dígitos numéricos.";
  }
  if (isEditing && form.password && !/^\d{4}$/.test(form.password)) {
    errors.password = "A nova senha deve ter exatamente 4 dígitos numéricos.";
  }
  if (isEditing && originalCategory !== form.category && !/^\d{4}$/.test(form.password)) {
    errors.password = "Ao alterar a categoria, informe uma nova senha de 4 dígitos.";
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
  const lookupCnpj = useServerFn(lookupPartnerCnpjFn);
  const [form, setForm] = useState<PartnerFormState>(() => emptyForm(allowedMenuIds));
  const [saving, setSaving] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);
  const [touchedSubmit, setTouchedSubmit] = useState(false);
  const [selectedSections, setSelectedSections] = useState<MenuSectionId[]>([]);
  const [generatedAccessCode, setGeneratedAccessCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const nextForm = partner ? formFromPartner(partner) : emptyForm(allowedMenuIds);
    setForm(nextForm);
    setSelectedSections(sectionsFromMenuIds(nextForm.menuIds));
    setTouchedSubmit(false);
  }, [allowedMenuIds, open, partner]);

  const grantableMenus = useMemo(
    () => MENU_ITEMS.filter((item) => allowedMenuIds.includes(item.id)),
    [allowedMenuIds],
  );

  const fieldErrors = useMemo(
    () => (touchedSubmit ? validateClientForm(form, Boolean(partner), partner?.category) : {}),
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

  const toggleSection = (sectionId: MenuSectionId) => {
    if (selectedSections.includes(sectionId)) {
      const sectionMenuIds = new Set(
        MENU_ITEMS.filter((item) => item.section === sectionId).map((item) => item.id),
      );
      setSelectedSections((current) => current.filter((id) => id !== sectionId));
      setForm((current) => {
        const menuIds = current.menuIds.filter((id) => !sectionMenuIds.has(id));
        return {
          ...current,
          menuIds,
          canCreatePartners: sectionId === "parceiros" ? false : current.canCreatePartners,
        };
      });
      return;
    }
    setSelectedSections((current) => [...current, sectionId]);
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
      name: current.personType === value ? current.name : "",
      taxId:
        current.personType === value
          ? maskTaxId(current.taxId, value === "pf" ? "cpf" : "cnpj")
          : "",
      rg: current.personType === value && value === "pf" ? current.rg : "",
    }));
  };

  const handleCategoryChange = (value: PartnerCategory) => {
    update("category", value);
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

  const handleLookupCnpj = async () => {
    if (form.personType !== "pj" || !isCompleteCnpj(form.taxId)) {
      toast.error("Informe um CNPJ válido com 14 dígitos.");
      return;
    }
    const requestedCnpj = form.taxId.replace(/\D/g, "");
    setLookingUpCnpj(true);
    try {
      const company = await lookupCnpj({ data: { cnpj: requestedCnpj } });
      setForm((current) => {
        if (current.personType !== "pj" || current.taxId.replace(/\D/g, "") !== requestedCnpj) {
          return current;
        }
        const companyPhone = isCompletePhoneBr(company.phone) ? maskPhoneBr(company.phone) : "";
        return {
          ...current,
          taxId: maskTaxId(company.cnpj, "cnpj"),
          name: company.legalName || current.name,
          email: isFilledValidEmail(company.email) ? company.email : current.email,
          phone: companyPhone || current.phone,
          whatsapp: companyPhone || current.whatsapp,
          cep: isCompleteCep(company.cep) ? maskCep(company.cep) : current.cep,
          street: company.street || current.street,
          neighborhood: company.neighborhood || current.neighborhood,
          city: company.city || current.city,
          state: company.state || current.state,
          complement: company.complement || current.complement,
          number: company.number || current.number,
        };
      });
      if (
        company.registrationStatus &&
        company.registrationStatus.toLocaleUpperCase("pt-BR") !== "ATIVA"
      ) {
        toast.warning(`Empresa localizada com situação ${company.registrationStatus}.`);
      } else {
        toast.success("Dados da empresa preenchidos pela BrasilAPI.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar o CNPJ.");
    } finally {
      setLookingUpCnpj(false);
    }
  };

  const handleSubmit = async () => {
    setTouchedSubmit(true);
    const errors = validateClientForm(form, Boolean(partner), partner?.category);
    const firstError = Object.values(errors)[0];
    if (firstError) {
      toast.error(firstError);
      return;
    }

    setSaving(true);
    try {
      const data = { ...form, password: form.password || undefined };
      if (partner) {
        const result = await updatePartner({ data: { ...data, partnerId: partner.id } });
        setGeneratedAccessCode(result.accessCode);
        toast.success("Parceiro atualizado.");
      } else {
        const result = await createPartner({ data });
        setGeneratedAccessCode(result.accessCode);
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
    <>
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
                    onValueChange={(value) => handleCategoryChange(value as PartnerCategory)}
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
                {form.personType === "pj" ? (
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <RequiredLabel htmlFor="partner-tax-id">CNPJ</RequiredLabel>
                      <div className="flex gap-2">
                        <Input
                          id="partner-tax-id"
                          value={form.taxId}
                          onChange={(event) =>
                            update("taxId", maskTaxId(event.target.value, "cnpj"))
                          }
                          aria-invalid={Boolean(fieldErrors.taxId)}
                          className={cn(
                            fieldErrors.taxId &&
                              "border-destructive focus-visible:ring-destructive",
                          )}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={lookingUpCnpj || !isCompleteCnpj(form.taxId)}
                          onClick={handleLookupCnpj}
                        >
                          {lookingUpCnpj ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Building2 className="size-4" />
                          )}
                          Buscar
                        </Button>
                      </div>
                      {fieldErrors.taxId ? (
                        <p className="text-xs text-destructive">{fieldErrors.taxId}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          A busca preenche automaticamente os dados disponíveis da empresa.
                        </p>
                      )}
                    </div>
                    <Field
                      id="partner-name"
                      label="Razão social"
                      value={form.name}
                      onChange={(value) => update("name", value)}
                      error={fieldErrors.name}
                      className="sm:col-span-2"
                      autoComplete="organization"
                      required
                    />
                  </>
                ) : (
                  <>
                    <Field
                      id="partner-name"
                      label="Nome completo"
                      value={form.name}
                      onChange={(value) => update("name", value)}
                      error={fieldErrors.name}
                      className="sm:col-span-2"
                      autoComplete="name"
                      required
                    />
                    <Field
                      id="partner-tax-id"
                      label="CPF"
                      value={form.taxId}
                      onChange={(value) => update("taxId", maskTaxId(value, "cpf"))}
                      error={fieldErrors.taxId}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="000.000.000-00"
                      maxLength={14}
                      required
                    />
                    <Field
                      id="partner-rg"
                      label="RG"
                      value={form.rg}
                      onChange={(value) => update("rg", value.slice(0, 30))}
                      error={fieldErrors.rg}
                      required
                    />
                  </>
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
                <div className="space-y-2">
                  <RequiredLabel htmlFor="partner-password" optional={Boolean(partner)}>
                    {partner ? "Nova senha numérica" : "Senha numérica"}
                  </RequiredLabel>
                  <div className="flex">
                    <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 font-mono text-sm font-semibold text-primary">
                      {partnerCategoryAlias(form.category)}
                    </span>
                    <Input
                      id="partner-password"
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(event) =>
                        update("password", event.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      aria-invalid={Boolean(fieldErrors.password)}
                      className={cn(
                        "rounded-l-none",
                        fieldErrors.password && "border-destructive focus-visible:ring-destructive",
                      )}
                      placeholder={partner ? "4 dígitos (se alterar)" : "4 dígitos"}
                      maxLength={4}
                      required={!partner || partner.category !== form.category}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Código de acesso final:{" "}
                    <span className="font-mono font-medium text-foreground">
                      {partnerCategoryAlias(form.category)}
                      {form.password || "••••"}
                    </span>
                  </p>
                  {fieldErrors.password ? (
                    <p className="text-xs text-destructive">{fieldErrors.password}</p>
                  ) : null}
                </div>
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
                  Seções, menus e permissões
                  <span className="ml-0.5 text-destructive" aria-hidden>
                    *
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Selecione Parceiros, Produção própria ou as duas seções. Depois escolha os
                  submenus que ficarão disponíveis.
                </p>
              </div>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {MENU_SECTIONS.map((section) => {
                    const availableItems = grantableMenus.filter(
                      (item) => item.section === section.id,
                    );
                    if (availableItems.length === 0) return null;
                    const selected = selectedSections.includes(section.id);
                    return (
                      <label
                        key={section.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm transition-colors",
                          selected
                            ? "border-primary/50 bg-primary/10"
                            : "border-border/60 hover:border-primary/30",
                        )}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleSection(section.id)}
                        />
                        <span>
                          <span className="block font-semibold">{section.label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {availableItems.length}{" "}
                            {availableItems.length === 1
                              ? "submenu disponível"
                              : "submenus disponíveis"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                {MENU_SECTIONS.map((section) => {
                  const items = grantableMenus.filter((item) => item.section === section.id);
                  if (items.length === 0 || !selectedSections.includes(section.id)) return null;
                  return (
                    <div
                      key={section.id}
                      className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4"
                    >
                      <div>
                        <p className="text-sm font-semibold">{section.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Selecione os menus desta seção.
                        </p>
                      </div>
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
                      {section.id === "parceiros" && allowedMenuIds.includes("parceiros") ? (
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                          <Checkbox
                            checked={form.canCreatePartners}
                            disabled={!form.menuIds.includes("parceiros")}
                            onCheckedChange={(checked) =>
                              update("canCreatePartners", checked === true)
                            }
                          />
                          <span>
                            <span className="block font-medium">
                              Cadastrar parceiros abaixo dele
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              O novo cadastro terá este parceiro como responsável fixo.
                            </span>
                          </span>
                        </label>
                      ) : null}
                    </div>
                  );
                })}
                {fieldErrors.menus ? (
                  <p className="text-xs text-destructive">{fieldErrors.menus}</p>
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

      <Dialog
        open={Boolean(generatedAccessCode)}
        onOpenChange={(next) => {
          if (!next) setGeneratedAccessCode(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />
              Código de acesso gerado
            </DialogTitle>
            <DialogDescription>
              Copie e envie este código ao parceiro. Por segurança, ele não será exibido novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              readOnly
              value={generatedAccessCode ?? ""}
              className="font-mono text-base font-semibold tracking-wider"
            />
            <Button
              type="button"
              onClick={async () => {
                if (!generatedAccessCode) return;
                try {
                  await navigator.clipboard.writeText(generatedAccessCode);
                  toast.success("Código copiado.");
                } catch {
                  toast.error("Não foi possível copiar automaticamente. Selecione o código.");
                }
              }}
            >
              <Copy className="size-4" />
              Copiar
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setGeneratedAccessCode(null)}>
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
