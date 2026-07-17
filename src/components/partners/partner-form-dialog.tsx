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

function formFromPartner(partner: PartnerRecord): PartnerFormState {
  return {
    category: partner.category,
    personType: partner.personType,
    name: partner.name,
    taxId: partner.taxId,
    rg: partner.rg,
    email: partner.email,
    password: "",
    phone: partner.phone,
    whatsapp: partner.whatsapp,
    pixKeyType: partner.pixKeyType,
    pixKey: partner.pixKey,
    cep: partner.cep,
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

function Field({
  id,
  label,
  value,
  onChange,
  ...props
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, "id" | "value" | "onChange">) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </div>
  );
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

  useEffect(() => {
    if (!open) return;
    setForm(partner ? formFromPartner(partner) : emptyForm(allowedMenuIds));
  }, [allowedMenuIds, open, partner]);

  const grantableMenus = useMemo(
    () => MENU_ITEMS.filter((item) => allowedMenuIds.includes(item.id)),
    [allowedMenuIds],
  );

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

  const handleLookupCep = async () => {
    setLookingUpCep(true);
    try {
      const address = await lookupCep({ data: { cep: form.cep } });
      setForm((current) => ({
        ...current,
        cep: address.cep,
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
            O responsável será quem criou o cadastro. Defina dados, bancos e acessos permitidos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-border/60 p-4">
            <h3 className="font-display text-sm font-semibold">Identificação</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
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
                <Label>Tipo de pessoa</Label>
                <Select
                  value={form.personType}
                  onValueChange={(value) => update("personType", value as PartnerPersonType)}
                >
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
                className="sm:col-span-2"
              />
              <Field
                id="partner-tax-id"
                label={form.personType === "pf" ? "CPF" : "CNPJ"}
                value={form.taxId}
                onChange={(value) => update("taxId", value)}
                inputMode="numeric"
              />
              {form.personType === "pf" ? (
                <Field
                  id="partner-rg"
                  label="RG"
                  value={form.rg}
                  onChange={(value) => update("rg", value)}
                />
              ) : (
                <div />
              )}
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border/60 p-4">
            <h3 className="font-display text-sm font-semibold">Acesso e contato</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="partner-email"
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(value) => update("email", value)}
              />
              <Field
                id="partner-password"
                label={partner ? "Nova senha (opcional)" : "Senha"}
                type="password"
                value={form.password}
                onChange={(value) => update("password", value)}
                placeholder={partner ? "Manter senha atual" : "Mínimo 8 caracteres"}
              />
              <Field
                id="partner-phone"
                label="Telefone"
                value={form.phone}
                onChange={(value) => update("phone", value)}
                inputMode="tel"
              />
              <Field
                id="partner-whatsapp"
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(value) => update("whatsapp", value)}
                inputMode="tel"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border/60 p-4">
            <h3 className="font-display text-sm font-semibold">Dados PIX</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de chave</Label>
                <Select
                  value={form.pixKeyType}
                  onValueChange={(value) => update("pixKeyType", value as PartnerPixKeyType)}
                >
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
              <Field
                id="partner-pix-key"
                label="Chave PIX"
                value={form.pixKey}
                onChange={(value) => update("pixKey", value)}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border/60 p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
              <MapPin className="size-4 text-primary" /> Endereço
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="partner-cep">CEP</Label>
                <div className="flex gap-2">
                  <Input
                    id="partner-cep"
                    value={form.cep}
                    onChange={(event) => update("cep", event.target.value)}
                    inputMode="numeric"
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
              </div>
              <Field
                id="partner-street"
                label="Endereço"
                value={form.street}
                onChange={(v) => update("street", v)}
                className="lg:col-span-2"
              />
              <Field
                id="partner-number"
                label="Número"
                value={form.number}
                onChange={(v) => update("number", v)}
              />
              <Field
                id="partner-complement"
                label="Complemento (opcional)"
                value={form.complement}
                onChange={(v) => update("complement", v)}
              />
              <Field
                id="partner-neighborhood"
                label="Bairro"
                value={form.neighborhood}
                onChange={(v) => update("neighborhood", v)}
              />
              <Field
                id="partner-city"
                label="Cidade"
                value={form.city}
                onChange={(v) => update("city", v)}
              />
              <Field
                id="partner-state"
                label="Estado (UF)"
                value={form.state}
                onChange={(v) => update("state", v.toUpperCase())}
                maxLength={2}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border/60 p-4">
            <div>
              <h3 className="font-display text-sm font-semibold">Bancos de atuação</h3>
              <p className="text-xs text-muted-foreground">
                Seleção preparada para a futura regra de produção.
              </p>
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
          </section>

          <section className="space-y-4 rounded-xl border border-border/60 p-4">
            <div>
              <h3 className="font-display text-sm font-semibold">Menus e permissões</h3>
              <p className="text-xs text-muted-foreground">
                Você só pode conceder acessos que também possui.
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
