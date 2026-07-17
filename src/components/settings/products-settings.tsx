import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/clients/status-badge";
import {
  CLIENT_FIELD_GROUPS,
  type ClientFieldGroup,
  type ClientFieldId,
} from "@/lib/config/client-fields";
import {
  createEmptyProduct,
  normalizeProductFields,
  resolveProductTagLabel,
} from "@/lib/config/settings-defaults";
import { DEFAULT_STATUS_COLOR, normalizeStatusColor } from "@/lib/config/status-colors";
import type { BankConfig, ProductConfig, SystemSettings } from "@/lib/config/settings-types";
import { cn } from "@/lib/utils";

type ProductBankListRow = {
  key: string;
  productId: string;
  productName: string;
  bankName: string;
  availableForPartners: boolean;
};

/** Uma linha por produto×banco (mesmo produto em 2 bancos = 2 linhas). */
function buildProductBankListRows(
  products: ProductConfig[],
  banks: BankConfig[],
): ProductBankListRow[] {
  const bankNameById = new Map(banks.map((bank) => [bank.id, bank.name.trim() || "Banco"]));
  const rows: ProductBankListRow[] = [];
  for (const product of products) {
    const productName = product.name.trim() || resolveProductTagLabel(product) || "Sem nome";
    const bankIds = [...new Set(product.bankIds ?? [])];
    if (bankIds.length === 0) {
      rows.push({
        key: `${product.id}::none`,
        productId: product.id,
        productName,
        bankName: "—",
        availableForPartners: Boolean(product.availableForPartners),
      });
      continue;
    }
    for (const bankId of bankIds) {
      rows.push({
        key: `${product.id}::${bankId}`,
        productId: product.id,
        productName,
        bankName: bankNameById.get(bankId) ?? "Banco removido",
        availableForPartners: Boolean(product.availableForPartners),
      });
    }
  }
  return rows;
}

type Props = {
  settings: SystemSettings;
  onChange: (settings: SystemSettings) => Promise<SystemSettings>;
};

type WizardStepId =
  | "identity"
  | "banks"
  | "pessoais-config"
  | "pessoais"
  | "profissionais"
  | "financeiros"
  | "partners";

const WIZARD_STEPS: Array<{ id: WizardStepId; label: string }> = [
  { id: "identity", label: "Nome e cor" },
  { id: "banks", label: "Bancos" },
  { id: "pessoais-config", label: "Config. dados pessoais" },
  { id: "pessoais", label: "Dados pessoais" },
  { id: "profissionais", label: "Dados profissionais" },
  { id: "financeiros", label: "Dados financeiros" },
  { id: "partners", label: "Parceiros" },
];

const PESSOAIS_CONFIG_FIELD_IDS: ClientFieldId[] = [
  "nome",
  "cpf",
  "rg",
  "data_nascimento",
  "sexo",
  "estado_civil",
  "telefone",
  "whatsapp",
  "email",
];

const PESSOAIS_ADDRESS_FIELD_IDS: ClientFieldId[] = [
  "tipo_logradouro",
  "logradouro",
  "numero_logradouro",
  "complemento",
  "bairro",
  "cidade",
  "uf",
];

function fieldsForWizardStep(step: WizardStepId): {
  title: string;
  fields: ClientFieldGroup["fields"];
} | null {
  const pessoais = CLIENT_FIELD_GROUPS.find((g) => g.id === "pessoais");
  if (step === "pessoais-config" && pessoais) {
    const idSet = new Set(PESSOAIS_CONFIG_FIELD_IDS);
    return {
      title: "Configurações dos Dados pessoais",
      fields: pessoais.fields.filter((field) => idSet.has(field.id)),
    };
  }
  if (step === "pessoais" && pessoais) {
    const idSet = new Set(PESSOAIS_ADDRESS_FIELD_IDS);
    return {
      title: "Dados pessoais",
      fields: pessoais.fields.filter((field) => idSet.has(field.id)),
    };
  }
  if (step === "profissionais") {
    const group = CLIENT_FIELD_GROUPS.find((g) => g.id === "profissionais");
    return group ? { title: group.title, fields: group.fields } : null;
  }
  if (step === "financeiros") {
    const group = CLIENT_FIELD_GROUPS.find((g) => g.id === "financeiros");
    return group ? { title: group.title, fields: group.fields } : null;
  }
  return null;
}

/** Persistência já chega filtrada pela seção "products" em Configurações. */
export function ProductsSettings({ settings, onChange }: Props) {
  const [products, setProducts] = useState<ProductConfig[]>(settings.products);
  const [selectedId, setSelectedId] = useState(settings.products[0]?.id ?? "");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const productsRef = useRef(products);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const colorEditingRef = useRef(false);
  productsRef.current = products;

  useEffect(() => {
    if (colorEditingRef.current) return;
    setProducts(settings.products);
    productsRef.current = settings.products;
    setSelectedId((current) => {
      if (current && settings.products.some((product) => product.id === current)) return current;
      return settings.products[0]?.id ?? "";
    });
    setCheckedIds((current) => current.filter((id) => settings.products.some((p) => p.id === id)));
  }, [settings.products]);

  const selected = products.find((product) => product.id === selectedId) ?? products[0];
  const currentStep = WIZARD_STEPS[stepIndex] ?? WIZARD_STEPS[0];
  const banks = settings.banks ?? [];
  const productBankRows = useMemo(
    () => buildProductBankListRows(products, banks),
    [products, banks],
  );

  const persistProducts = (
    nextProducts: ProductConfig[],
    options?: { successMessage?: string; quiet?: boolean },
  ) => {
    setProducts(nextProducts);
    productsRef.current = nextProducts;
    if (!options?.quiet) setSaving(true);

    const run = async () => {
      try {
        const saved = await onChange({ ...settings, products: productsRef.current });
        if (saved?.products) {
          if (colorEditingRef.current) {
            const localById = new Map(productsRef.current.map((p) => [p.id, p]));
            const merged = saved.products.map((p) => {
              const local = localById.get(p.id);
              if (local && p.id === selectedId) {
                return {
                  ...p,
                  color: local.color,
                  name: local.name,
                  tag: local.tag,
                  bankIds: local.bankIds,
                  availableForPartners: local.availableForPartners,
                };
              }
              return p;
            });
            setProducts(merged);
            productsRef.current = merged;
          } else {
            setProducts(saved.products);
            productsRef.current = saved.products;
          }
          setSelectedId((current) => {
            if (current && saved.products.some((product) => product.id === current)) return current;
            return saved.products[0]?.id ?? "";
          });
          setCheckedIds((current) =>
            current.filter((id) => saved.products.some((product) => product.id === id)),
          );
        }
        if (!options?.quiet) {
          toast.success(options?.successMessage ?? "Produtos salvos.");
        }
      } catch (error) {
        setProducts(settings.products);
        productsRef.current = settings.products;
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar os produtos.");
        throw error;
      } finally {
        if (!options?.quiet) setSaving(false);
      }
    };

    const queued = saveChainRef.current.then(run, run);
    saveChainRef.current = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  };

  const updateSelected = (patch: Partial<ProductConfig>) => {
    if (!selected) return;
    const next = normalizeProductFields({ ...selected, ...patch });
    const nextProducts = products.map((product) => (product.id === selected.id ? next : product));
    void persistProducts(nextProducts, { quiet: true });
  };

  const patchSelectedLocal = (patch: Partial<ProductConfig>) => {
    if (!selected) return;
    setProducts((prev) => {
      const next = prev.map((product) =>
        product.id === selected.id ? { ...product, ...patch } : product,
      );
      productsRef.current = next;
      return next;
    });
  };

  const persistSelectedQuiet = () => {
    if (!selectedId) return;
    const nextProducts = productsRef.current.map((product) =>
      product.id === selectedId ? normalizeProductFields(product) : product,
    );
    void persistProducts(nextProducts, { quiet: true });
  };

  const setFieldRequired = (fieldId: ClientFieldId, required: boolean) => {
    if (!selected) return;
    const requiredFieldIds = required
      ? [...new Set([...selected.requiredFieldIds, fieldId])]
      : selected.requiredFieldIds.filter((id) => id !== fieldId);
    updateSelected({ requiredFieldIds });
  };

  const toggleBankId = (bankId: string, checked: boolean) => {
    if (!selected) return;
    const bankIds = checked
      ? [...new Set([...(selected.bankIds ?? []), bankId])]
      : (selected.bankIds ?? []).filter((id) => id !== bankId);
    updateSelected({ bankIds });
  };

  const addProduct = () => {
    const product = createEmptyProduct();
    product.name = "Novo produto";
    const nextProducts = [...products, product];
    setProducts(nextProducts);
    setSelectedId(product.id);
    setStepIndex(0);
    void persistProducts(nextProducts, { successMessage: "Produto criado." });
  };

  const toggleChecked = (id: string, checked: boolean) => {
    setCheckedIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter((item) => item !== id);
    });
  };

  const requestDeleteIds = (ids: string[]) => {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return;
    if (products.length - uniqueIds.length < 1) {
      toast.error("Mantenha ao menos um produto.");
      return;
    }
    setPendingDeleteIds(uniqueIds);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteIds?.length) return;
    const idsToRemove = [...pendingDeleteIds];
    const removeSet = new Set(idsToRemove);
    const nextProducts = products.filter((product) => !removeSet.has(product.id));
    if (nextProducts.length < 1) {
      toast.error("Mantenha ao menos um produto.");
      setPendingDeleteIds(null);
      return;
    }
    setPendingDeleteIds(null);
    if (selectedId && removeSet.has(selectedId)) {
      setSelectedId(nextProducts[0]?.id ?? "");
    }
    setCheckedIds((current) => current.filter((id) => !removeSet.has(id)));
    try {
      await persistProducts(nextProducts, {
        successMessage:
          idsToRemove.length > 1 ? `${idsToRemove.length} produtos excluídos.` : "Produto excluído.",
      });
    } catch {
      // toast already shown
    }
  };

  const goNext = () => {
    if (!selected) return;
    if (currentStep.id === "identity" && !selected.name.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    setStepIndex((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
    persistSelectedQuiet();
  };

  const goPrev = () => {
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const finishWizard = async () => {
    if (!selectedId) return;
    const nextProducts = productsRef.current.map((product) =>
      product.id === selectedId ? normalizeProductFields(product) : product,
    );
    try {
      await persistProducts(nextProducts, { successMessage: "Produto salvo." });
      setStepIndex(0);
    } catch {
      // toast already shown
    }
  };

  const deleteDialogCount = pendingDeleteIds?.length ?? 0;
  const fieldStep = fieldsForWizardStep(currentStep.id);

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <Card className="border-border/60 shadow-soft h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Produtos</CardTitle>
          <CardDescription>
            Marque um ou mais para excluir em lote. Clique no nome para editar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {products.map((product) => {
            const isSelected = selected?.id === product.id;
            const isChecked = checkedIds.includes(product.id);
            return (
              <div
                key={product.id}
                className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                  isSelected
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/60 hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  className="mt-1.5"
                  checked={isChecked}
                  disabled={saving}
                  onCheckedChange={(value) => toggleChecked(product.id, Boolean(value))}
                  aria-label={`Selecionar ${product.name || "produto"}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(product.id);
                    setStepIndex(0);
                  }}
                  className="min-w-0 flex-1 rounded-md px-1 py-1 text-left text-sm"
                >
                  <span className="flex flex-col items-start gap-1">
                    <StatusBadge
                      label={resolveProductTagLabel(product)}
                      color={product.color}
                      className="max-w-full"
                    />
                    <span className="text-xs text-muted-foreground">
                      {(product.bankIds ?? []).length} banco(s) · {product.requiredFieldIds.length}{" "}
                      obrigatório(s)
                    </span>
                  </span>
                </button>
              </div>
            );
          })}

          <div className="flex flex-col gap-2 pt-2">
            {checkedIds.length > 0 ? (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                disabled={saving}
                onClick={() => requestDeleteIds(checkedIds)}
              >
                <Trash2 className="size-4" />
                Excluir selecionados ({checkedIds.length})
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="w-full" onClick={addProduct} disabled={saving}>
              <Plus className="size-4" /> Novo produto
            </Button>
          </div>
        </CardContent>
      </Card>

      {selected ? (
        <Card className="border-border/60 shadow-soft">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="font-display text-base">Configurar produto</CardTitle>
              <CardDescription>
                Etapa {stepIndex + 1} de {WIZARD_STEPS.length}: {currentStep.label}
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => requestDeleteIds([selected.id])}
              disabled={saving}
              title="Excluir produto"
            >
              <Trash2 className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {WIZARD_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    index === stepIndex
                      ? "border-primary/50 bg-primary/15 text-foreground"
                      : "border-border/60 text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  {index + 1}. {step.label}
                </button>
              ))}
            </div>

            {currentStep.id === "identity" ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="product-name">Nome do produto</Label>
                    <Input
                      id="product-name"
                      value={selected.name}
                      onChange={(e) => {
                        const nextProducts = products.map((product) =>
                          product.id === selected.id
                            ? { ...product, name: e.target.value, tag: e.target.value }
                            : product,
                        );
                        setProducts(nextProducts);
                        productsRef.current = nextProducts;
                      }}
                      onBlur={() => persistSelectedQuiet()}
                      placeholder="Ex.: Empréstimo CLT, FGTS, Cartão consignado"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-color">Cor da tag</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="product-color"
                        type="color"
                        value={normalizeStatusColor(selected.color, DEFAULT_STATUS_COLOR)}
                        onFocus={() => {
                          colorEditingRef.current = true;
                        }}
                        onInput={(event) => {
                          colorEditingRef.current = true;
                          patchSelectedLocal({ color: event.currentTarget.value });
                        }}
                        onChange={(event) => {
                          colorEditingRef.current = true;
                          patchSelectedLocal({ color: event.currentTarget.value });
                        }}
                        onBlur={() => {
                          colorEditingRef.current = false;
                          persistSelectedQuiet();
                        }}
                        className="h-9 w-9 shrink-0 cursor-pointer appearance-none border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-0"
                        aria-label="Cor da tag do produto"
                        title="Cor da tag"
                      />
                      <StatusBadge label={resolveProductTagLabel(selected)} color={selected.color} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Produtos cadastrados</p>
                  <p className="text-xs text-muted-foreground">
                    Cada banco vinculado aparece em uma linha. Clique na linha para editar o produto.
                  </p>
                  {productBankRows.length === 0 ? (
                    <p className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                      Nenhum produto cadastrado ainda.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border/60">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">Nome do produto</th>
                            <th className="px-4 py-3 font-medium">Banco</th>
                            <th className="px-4 py-3 font-medium text-center">Parceiros</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productBankRows.map((row) => {
                            const isActive = row.productId === selected.id;
                            return (
                              <tr
                                key={row.key}
                                className={cn(
                                  "border-t border-border/60 cursor-pointer transition-colors hover:bg-muted/40",
                                  isActive && "bg-primary/10",
                                )}
                                onClick={() => {
                                  setSelectedId(row.productId);
                                  setStepIndex(0);
                                }}
                              >
                                <td className="px-4 py-3 font-medium">{row.productName}</td>
                                <td className="px-4 py-3 text-muted-foreground">{row.bankName}</td>
                                <td className="px-4 py-3 text-center">
                                  {row.availableForPartners ? (
                                    <span
                                      className="inline-flex size-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"
                                      title="Disponível para parceiros"
                                      aria-label="Disponível para parceiros"
                                    >
                                      <Check className="size-3.5" strokeWidth={3} />
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {currentStep.id === "banks" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Selecione um ou mais bancos cadastrados em Configurações → Bancos.
                </p>
                {banks.length === 0 ? (
                  <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    Nenhum banco cadastrado. Cadastre bancos na aba Bancos antes de vincular.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {banks.map((bank) => {
                      const checked = (selected.bankIds ?? []).includes(bank.id);
                      return (
                        <label
                          key={bank.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 p-3",
                            checked && "border-primary/40 bg-primary/5",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleBankId(bank.id, value === true)}
                          />
                          <span className="text-sm font-medium">{bank.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {fieldStep ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                  Marque <strong className="text-foreground">Obrigatório</strong> para exigir o campo
                  no cadastro. Desmarcado = disponível (opcional).
                </div>
                <h3 className="text-sm font-semibold">{fieldStep.title}</h3>
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Campo</th>
                        <th className="px-4 py-2 font-medium w-28 text-center">Disponível</th>
                        <th className="px-4 py-2 font-medium w-28 text-center">Obrigatório</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fieldStep.fields.map((field) => {
                        const required = selected.requiredFieldIds.includes(field.id);
                        const available = !required;
                        return (
                          <tr key={field.id} className="border-t border-border/60">
                            <td className="px-4 py-3">
                              <div className="font-medium">{field.label}</div>
                              {field.hint ? (
                                <div className="text-xs text-muted-foreground">{field.hint}</div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Checkbox
                                checked={available}
                                disabled={available}
                                onCheckedChange={() => setFieldRequired(field.id, false)}
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Checkbox
                                checked={required}
                                onCheckedChange={(value) =>
                                  setFieldRequired(field.id, value === true)
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {currentStep.id === "partners" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Disponibilizar este produto para parceiros? (o fluxo de uso será detalhado depois.)
                </p>
                <div className="flex flex-wrap gap-3">
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 px-4 py-3",
                      selected.availableForPartners && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <Checkbox
                      checked={selected.availableForPartners === true}
                      onCheckedChange={(value) =>
                        updateSelected({ availableForPartners: value === true })
                      }
                    />
                    <span className="text-sm font-medium">Sim</span>
                  </label>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 px-4 py-3",
                      !selected.availableForPartners && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <Checkbox
                      checked={selected.availableForPartners === false}
                      onCheckedChange={(value) => {
                        if (value === true) updateSelected({ availableForPartners: false });
                      }}
                    />
                    <span className="text-sm font-medium">Não</span>
                  </label>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={goPrev}
                disabled={stepIndex === 0 || saving}
              >
                <ChevronLeft className="size-4" /> Anterior
              </Button>
              {stepIndex < WIZARD_STEPS.length - 1 ? (
                <Button type="button" onClick={goNext} disabled={saving}>
                  Próximo <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button type="button" onClick={() => void finishWizard()} disabled={saving}>
                  Concluir
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog
        open={pendingDeleteIds !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteIds(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialogCount > 1 ? `Excluir ${deleteDialogCount} produtos?` : "Excluir produto?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialogCount > 1
                ? "Os produtos selecionados serão removidos. Clientes já cadastrados não são apagados."
                : "Este produto será removido. Clientes já cadastrados não são apagados."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
