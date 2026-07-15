import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ClientFieldInput } from "@/components/clients/client-field-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useSystemSettings } from "@/hooks/use-system-settings";
import type { ClientFieldId } from "@/lib/config/client-fields";
import type { ProductConfig } from "@/lib/config/settings-types";
import { productFieldsForImport } from "@/lib/clients/product-fields";
import { createManualClientFn, listUsersForImportFn } from "@/lib/clients/clients.server";
import type { LeadDistribution } from "@/lib/clients/client.types";
import {
  buildLeadDistribution,
  isDistributionValid,
  LeadDistributionForm,
  type DistributionUser,
} from "@/components/clients/lead-distribution-form";
import { isValidEmail } from "@/lib/masks/email";
import { cpfDigits } from "@/lib/masks/br-cpf";
import { phoneDigits } from "@/lib/masks/br-phone";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

const STEPS = ["Produto", "Dados", "Distribuição"] as const;

export function ClientCreateManualDialog({ open, onOpenChange, onCreated }: Props) {
  const { settings } = useSystemSettings();
  const createClient = useServerFn(createManualClientFn);
  const listUsers = useServerFn(listUsersForImportFn);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [productId, setProductId] = useState("");
  const [formData, setFormData] = useState<Partial<Record<ClientFieldId, string>>>({});
  const [distributionType, setDistributionType] = useState<LeadDistribution["type"]>("all");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [scheduleContactDate, setScheduleContactDate] = useState("");
  const [importUsers, setImportUsers] = useState<DistributionUser[]>([]);

  const product = settings.products.find((item) => item.id === productId) as ProductConfig | undefined;
  const fieldGroups = useMemo(() => (product ? productFieldsForImport(product) : null), [product]);

  useEffect(() => {
    if (!open) return;
    listUsers()
      .then(setImportUsers)
      .catch(() => setImportUsers([]));
  }, [open, listUsers]);

  const reset = () => {
    setStep(0);
    setProductId("");
    setFormData({});
    setDistributionType("all");
    setCategoryIds([]);
    setUserIds([]);
    setScheduleContactDate("");
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const setField = (fieldId: ClientFieldId, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const canGoNext = () => {
    if (step === 0) return Boolean(productId);
    if (step === 1 && fieldGroups) {
      const requiredOk = fieldGroups.required.every((field) => formData[field.id]?.trim());
      if (!requiredOk) return false;
      const email = formData.email?.trim() ?? "";
      if (email && !isValidEmail(email)) return false;
      const cpfRaw = formData.cpf?.trim() ?? "";
      if (cpfRaw && cpfDigits(cpfRaw).length !== 11) return false;
      for (const phoneKey of ["telefone", "whatsapp"] as const) {
        const raw = formData[phoneKey]?.trim() ?? "";
        if (!raw) continue;
        const digits = phoneDigits(raw);
        if (digits.length > 0 && digits.length < 10) return false;
      }
      return true;
    }
    if (step === 2) return isDistributionValid(distributionType, categoryIds, userIds);
    return true;
  };

  const handleCreate = async () => {
    if (!product) return;
    const email = formData.email?.trim() ?? "";
    if (email && !isValidEmail(email)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setLoading(true);
    try {
      await createClient({
        data: {
          productId: product.id,
          data: formData,
          distribution: buildLeadDistribution(distributionType, categoryIds, userIds),
          scheduleContactDate: scheduleContactDate.trim() || undefined,
        },
      });
      toast.success("Cliente criado com sucesso.");
      onCreated();
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o cliente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 shrink-0" /> Novo cliente
          </DialogTitle>
          <DialogDescription>
            Passo {step + 1} de {STEPS.length}: {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {STEPS.map((label, index) => (
            <Badge key={label} variant={index === step ? "default" : index < step ? "secondary" : "outline"}>
              {index + 1}. {label}
            </Badge>
          ))}
        </div>

        {step === 0 ? (
          <div className="space-y-3">
            <Label>Produto</Label>
            <p className="text-xs text-muted-foreground">
              O produto define quais campos são obrigatórios no cadastro manual.
            </p>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {settings.products.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {step === 1 && fieldGroups ? (
          <div className="space-y-5">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Campos obrigatórios</h3>
              {fieldGroups.required.map((field) => (
                <div key={field.id} className="flex flex-col gap-3">
                  <Label htmlFor={`manual-${field.id}`} className="flex flex-wrap items-center gap-2">
                    <span>{field.label}</span>
                    <Badge>Obrigatório</Badge>
                  </Label>
                  <ClientFieldInput
                    id={`manual-${field.id}`}
                    fieldId={field.id}
                    value={formData[field.id] ?? ""}
                    onChange={(value) => setField(field.id, value)}
                    banks={settings.banks ?? []}
                    required
                  />
                </div>
              ))}
            </div>
            {fieldGroups.optional.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Campos disponíveis (opcional)</h3>
                {fieldGroups.optional.map((field) => (
                  <div key={field.id} className="flex flex-col gap-3">
                    <Label htmlFor={`manual-opt-${field.id}`}>{field.label}</Label>
                    <ClientFieldInput
                      id={`manual-opt-${field.id}`}
                      fieldId={field.id}
                      value={formData[field.id] ?? ""}
                      onChange={(value) => setField(field.id, value)}
                      banks={settings.banks ?? []}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <LeadDistributionForm
            distributionType={distributionType}
            onDistributionTypeChange={setDistributionType}
            categoryIds={categoryIds}
            onCategoryIdsChange={setCategoryIds}
            userIds={userIds}
            onUserIdsChange={setUserIds}
            categories={settings.categories}
            users={importUsers}
            scheduleContactDate={scheduleContactDate}
            onScheduleContactDateChange={setScheduleContactDate}
          />
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={step === 0 ? close : () => setStep((value) => value - 1)}
          >
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!canGoNext()}
              onClick={() => setStep((value) => value + 1)}
            >
              Próximo
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!canGoNext() || loading}
              onClick={() => void handleCreate()}
            >
              {loading ? "Salvando…" : "Criar cliente"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
