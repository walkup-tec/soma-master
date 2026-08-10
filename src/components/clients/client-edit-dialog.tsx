import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { IdCard, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { ClientFieldInput } from "@/components/clients/client-field-input";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { productFieldsForImport } from "@/lib/clients/product-fields";
import { getClientDetailFn, updateClientCadastroFn } from "@/lib/clients/clients.server";
import type { ClientListItem, ClientRecord } from "@/lib/clients/client.types";
import { clientFieldLabel, type ClientFieldId } from "@/lib/config/client-fields";
import { cpfDigits } from "@/lib/masks/br-cpf";
import { isValidEmail } from "@/lib/masks/email";

type Props = {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (client: ClientRecord) => void;
};

function clientTitle(client: ClientRecord): string {
  return client.data.nome ?? client.data.cpf ?? client.data.telefone ?? client.id;
}

export function ClientEditDialog({ clientId, open, onOpenChange, onSaved }: Props) {
  const { settings } = useSystemSettings();
  const getClientDetail = useServerFn(getClientDetailFn);
  const updateCadastro = useServerFn(updateClientCadastroFn);

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [fields, setFields] = useState<Partial<Record<ClientFieldId, string>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const product = useMemo(
    () => settings.products.find((item) => item.id === client?.productId) ?? null,
    [client?.productId, settings.products],
  );

  const fieldOptions = useMemo(() => {
    if (!product) return [];
    const { required, optional } = productFieldsForImport(product);
    const options = [...required, ...optional];
    const seen = new Set(options.map((item) => item.id));
    if (client) {
      for (const key of Object.keys(client.data) as ClientFieldId[]) {
        if (seen.has(key)) continue;
        const value = client.data[key]?.trim();
        if (!value) continue;
        options.push({
          id: key,
          label: clientFieldLabel(key, product.customFields),
          required: false,
        });
        seen.add(key);
      }
    }
    return options;
  }, [client, product]);

  useEffect(() => {
    if (!open || !clientId) {
      setClient(null);
      setFields({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getClientDetail({ data: { clientId } })
      .then((detail) => {
        if (cancelled) return;
        setClient(detail);
        setFields({ ...(detail.data ?? {}) });
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error instanceof Error ? error.message : "Falha ao carregar cliente");
        onOpenChange(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, clientId, getClientDetail, onOpenChange]);

  async function handleSave() {
    if (!clientId || !client || !product) return;

    for (const field of fieldOptions.filter((item) => item.required)) {
      if (!String(fields[field.id] ?? "").trim()) {
        toast.error(`Preencha: ${field.label}`);
        return;
      }
    }
    const email = fields.email?.trim() ?? "";
    if (email && !isValidEmail(email)) {
      toast.error("E-mail inválido.");
      return;
    }
    const cpfRaw = fields.cpf?.trim() ?? "";
    if (cpfRaw && cpfDigits(cpfRaw).length !== 11) {
      toast.error("CPF inválido.");
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Record<ClientFieldId, string>> = {};
      for (const field of fieldOptions) {
        payload[field.id] = String(fields[field.id] ?? "");
      }
      const next = await updateCadastro({
        data: { clientId, data: payload },
      });
      setClient(next);
      setFields({ ...(next.data ?? {}) });
      onSaved?.(next);
      toast.success("Cadastro atualizado");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar cadastro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,900px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <IdCard className="size-5 text-primary" />
            Cadastro do cliente
          </DialogTitle>
          <DialogDescription>
            {client ? (
              <>
                Edite os dados de{" "}
                <span className="font-medium text-foreground">{clientTitle(client)}</span> e salve.
              </>
            ) : (
              "Carregando cadastro…"
            )}
          </DialogDescription>
        </DialogHeader>

        {loading && !client ? (
          <div className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando…
          </div>
        ) : client ? (
          <>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-5 p-6">
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground">Produto</p>
                  <p className="font-medium">{product?.name ?? client.productId}</p>
                </div>

                {fieldOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este produto não possui campos configurados para cadastro.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {fieldOptions.map((field) => (
                      <div
                        key={field.id}
                        className={
                          field.id === "logradouro" || field.id === "complemento"
                            ? "space-y-1.5 sm:col-span-2"
                            : "space-y-1.5"
                        }
                      >
                        <Label htmlFor={`edit-client-${field.id}`} className="text-xs">
                          {field.label}
                          {field.required ? <span className="text-destructive"> *</span> : null}
                        </Label>
                        <ClientFieldInput
                          id={`edit-client-${field.id}`}
                          fieldId={field.id}
                          value={fields[field.id] ?? ""}
                          banks={settings.banks}
                          required={field.required}
                          onChange={(value) =>
                            setFields((prev) => ({
                              ...prev,
                              [field.id]: value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={saving || fieldOptions.length === 0}
                className="cursor-pointer"
                onClick={() => void handleSave()}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar cadastro
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Helper para patch da lista após salvar. */
export function clientRecordToListPatch(client: ClientRecord): Partial<ClientListItem> {
  return {
    nome: client.data.nome ?? null,
    cpf: client.data.cpf ?? null,
    telefone: client.data.telefone ?? null,
    status: client.status,
  };
}
