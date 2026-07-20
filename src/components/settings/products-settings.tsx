import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
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
  /**
   * production = Configurações (não lista partnerOnly).
   * partners = Parceiros → Produtos (só partnerOnly; mesma tela/wizard).
   */
  catalog?: "production" | "partners";
};

type WizardStepId =
  | "identity"
  | "banks"
  | "pessoais-config"
  | "pessoais"
  | "profissionais"
  | "financeiros"
  | "partners";

const WIZARD_STEPS_PRODUCTION: Array<{ id: WizardStepId; label: string }> = [
  { id: "identity", label: "Nome e cor" },
  { id: "banks", label: "Bancos" },
  { id: "pessoais-config", label: "Config. dados pessoais" },
  { id: "pessoais", label: "Dados pessoais" },
  { id: "profissionais", label: "Dados profissionais" },
  { id: "financeiros", label: "Dados financeiros" },
  { id: "partners", label: "Parceiros" },
];

/** Em Parceiros o produto já é só para parceiros — sem etapa Sim/Não. */
const WIZARD_STEPS_PARTNERS: Array<{ id: WizardStepId; label: string }> = [
  { id: "identity", label: "Nome e cor" },
  { id: "banks", label: "Bancos" },
  { id: "pessoais-config", label: "Config. dados pessoais" },
  { id: "pessoais", label: "Dados pessoais" },
  { id: "profissionais", label: "Dados profissionais" },
  { id: "financeiros", label: "Dados financeiros" },
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

function isCatalogProduct(product: ProductConfig, catalog: "production" | "partners"): boolean {
  return catalog === "partners" ? Boolean(product.partnerOnly) : !product.partnerOnly;
}

function catalogProducts(
  products: ProductConfig[],
  catalog: "production" | "partners",
): ProductConfig[] {
  return products.filter((product) => isCatalogProduct(product, catalog));
}

/** Mantém o outro catálogo intacto ao salvar. */
function mergeCatalogProducts(
  nextScoped: ProductConfig[],
  allFromSettings: ProductConfig[],
  catalog: "production" | "partners",
): ProductConfig[] {
  if (catalog === "partners") {
    const own = allFromSettings.filter((product) => !product.partnerOnly);
    return [
      ...own,
      ...nextScoped.map((product) => ({
        ...product,
        partnerOnly: true,
        availableForPartners: true,
      })),
    ];
  }
  const partnerOnly = allFromSettings.filter((product) => product.partnerOnly);
  return [...nextScoped.map((product) => ({ ...product, partnerOnly: false })), ...partnerOnly];
}

export function ProductsSettings({ settings, onChange, catalog = "production" }: Props) {
  const isPartnersCatalog = catalog === "partners";
  const wizardSteps = isPartnersCatalog ? WIZARD_STEPS_PARTNERS : WIZARD_STEPS_PRODUCTION;

  const [products, setProducts] = useState<ProductConfig[]>(() =>
    catalogProducts(settings.products, catalog),
  );
  const [selectedId, setSelectedId] = useState(
    () => catalogProducts(settings.products, catalog)[0]?.id ?? "",
  );
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
    const next = catalogProducts(settings.products, catalog);
    setProducts(next);
    productsRef.current = next;
    setSelectedId((current) => {
      if (current && next.some((product) => product.id === current)) return current;
      return next[0]?.id ?? "";
    });
    setCheckedIds((current) => current.filter((id) => next.some((p) => p.id === id)));
  }, [settings.products, catalog]);

  const selected = products.find((product) => product.id === selectedId) ?? products[0];
  const currentStep = wizardSteps[stepIndex] ?? wizardSteps[0];
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
        const toSave = mergeCatalogProducts(productsRef.current, settings.products, catalog);
        const saved = await onChange({ ...settings, products: toSave });
        if (saved?.products) {
          const savedScoped = catalogProducts(saved.products, catalog);
          if (colorEditingRef.current) {
            const localById = new Map(productsRef.current.map((p) => [p.id, p]));
            const merged = savedScoped.map((p) => {
              const local = localById.get(p.id);
              if (local && p.id === selectedId) {
                return {
                  ...p,
                  color: local.color,
                  name: local.name,
                  tag: local.tag,
                  bankIds: local.bankIds,
                  availableForPartners: local.availableForPartners,
                  partnerOnly: local.partnerOnly,
                };
              }
              return p;
            });
            setProducts(merged);
            productsRef.current = merged;
          } else {
            setProducts(savedScoped);
            productsRef.current = savedScoped;
          }
          setSelectedId((current) => {
            if (current && savedScoped.some((product) => product.id === current)) return current;
            return savedScoped[0]?.id ?? "";
          });
          setCheckedIds((current) =>
            current.filter((id) => savedScoped.some((product) => product.id === id)),
          );
        }
        if (!options?.quiet) {
          toast.success(options?.successMessage ?? "Produtos salvos.");
        }
      } catch (error) {
        const rollback = catalogProducts(settings.products, catalog);
        setProducts(rollback);
        productsRef.current = rollback;
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
    const product = createEmptyProduct({ partnerOnly: isPartnersCatalog });
    product.name = "Novo produto";
    if (isPartnersCatalog) {
      product.availableForPartners = true;
      product.partnerOnly = true;
    }
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

  const setAvailableForPartners = (productId: string, available: boolean) => {
    const nextProducts = products.map((product) =>
      product.id === productId
        ? normalizeProductFields({ ...product, availableForPartners: available })
        : product,
    );
    void persistProducts(nextProducts, {
      successMessage: available
        ? "Produto disponível na seção Parceiros."
        : "Produto removido da seção Parceiros.",
    });
  };

  const editProductFromList = (productId: string) => {
    setSelectedId(productId);
    setStepIndex(0);
  };

  const requestDeleteIds = (ids: string[]) => {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return;
    if (!isPartnersCatalog && products.length - uniqueIds.length < 1) {
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
    if (!isPartnersCatalog && nextProducts.length < 1) {
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
    setStepIndex((current) => Math.min(current + 1, wizardSteps.length - 1));
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
    <div className="space-y-4">
      {isPartnersCatalog ? (
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Produtos para parceiros
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Mesmo cadastro da Produção própria. Produtos criados aqui ficam disponíveis aos
            parceiros e não aparecem em Produção própria. Produtos da Produção própria marcados
            como &quot;Sim&quot; para parceiros continuam gerenciados em Configurações → Produtos.
          </p>
        </div>
      ) : null}

      {/* Card superior: apenas etapas de criação/edição */}
      <Card className="border-border/60 shadow-soft">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="font-display text-base">
              {selected ? "Configurar produto" : "Cadastrar produto"}
            </CardTitle>
            <CardDescription>
              {selected
                ? `Etapa ${stepIndex + 1} de ${wizardSteps.length}: ${currentStep.label}`
                : "Use Novo produto para iniciar o cadastro. As etapas ficam só neste card."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {selected ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => requestDeleteIds([selected.id])}
                disabled={saving}
                title="Excluir produto em edição"
              >
                <Trash2 className="size-4" />
                Excluir
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={addProduct} disabled={saving}>
              <Plus className="size-4" /> Novo produto
            </Button>
          </div>
        </CardHeader>

        {selected ? (
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {wizardSteps.map((step, index) => (
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
              {stepIndex < wizardSteps.length - 1 ? (
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
        ) : (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {isPartnersCatalog
              ? 'Clique em "Novo produto" para cadastrar um produto exclusivo dos parceiros.'
              : 'Clique em "Novo produto" para iniciar as etapas de cadastro.'}
          </CardContent>
        )}
      </Card>

      {/* Card inferior: listagem independente do wizard */}
      <Card className="border-border/60 shadow-soft">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="font-display text-base">Produtos cadastrados</CardTitle>
            <CardDescription>
              {isPartnersCatalog
                ? "Cada banco vinculado aparece em uma linha. Use editar ou excluir nas ações."
                : "Cada banco vinculado aparece em uma linha. Marque Parceiros para exibir na seção Parceiros. Edite ou exclua pelas ações."}
            </CardDescription>
          </div>
          {checkedIds.length > 0 ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={saving}
              onClick={() => requestDeleteIds(checkedIds)}
            >
              <Trash2 className="size-4" />
              Excluir selecionados ({checkedIds.length})
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {productBankRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum produto cadastrado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-10 px-3 py-3 font-medium">
                      <span className="sr-only">Selecionar</span>
                    </th>
                    <th className="px-4 py-3 font-medium">Nome do produto</th>
                    <th className="px-4 py-3 font-medium">Banco</th>
                    {isPartnersCatalog ? null : (
                      <th className="px-4 py-3 font-medium text-center">Parceiros</th>
                    )}
                    <th className="px-4 py-3 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {productBankRows.map((row) => {
                    const isActive = row.productId === selected?.id;
                    const isChecked = checkedIds.includes(row.productId);
                    return (
                      <tr
                        key={row.key}
                        className={cn(
                          "border-t border-border/60 transition-colors",
                          isActive && "bg-primary/10",
                        )}
                      >
                        <td className="px-3 py-3">
                          <Checkbox
                            checked={isChecked}
                            disabled={saving}
                            onCheckedChange={(value) =>
                              toggleChecked(row.productId, Boolean(value))
                            }
                            aria-label={`Selecionar ${row.productName}`}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium">{row.productName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.bankName}</td>
                        {isPartnersCatalog ? null : (
                          <td className="px-4 py-3">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={row.availableForPartners}
                                disabled={saving}
                                onCheckedChange={(value) =>
                                  setAvailableForPartners(row.productId, value === true)
                                }
                                aria-label={
                                  row.availableForPartners
                                    ? `Remover ${row.productName} da seção Parceiros`
                                    : `Exibir ${row.productName} na seção Parceiros`
                                }
                              />
                            </div>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={saving}
                              title="Editar produto"
                              aria-label={`Editar ${row.productName}`}
                              onClick={() => editProductFromList(row.productId)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={saving}
                              title="Excluir produto"
                              aria-label={`Excluir ${row.productName}`}
                              onClick={() => requestDeleteIds([row.productId])}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
