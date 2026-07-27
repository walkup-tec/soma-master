import { useEffect, useMemo, useRef, useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, FileUp, Pencil, Plus, Trash2 } from "lucide-react";
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
  isCustomClientFieldId,
  type ClientFieldGroupId,
  type ClientFieldId,
} from "@/lib/config/client-fields";
import {
  createEmptyProduct,
  normalizeProductFields,
  resolveProductTagLabel,
} from "@/lib/config/settings-defaults";
import { uploadProductOperationalGuideFn } from "@/lib/config/settings.server";
import { DEFAULT_STATUS_COLOR, normalizeStatusColor } from "@/lib/config/status-colors";
import type {
  BankConfig,
  ProductConfig,
  ProductCustomField,
  SystemSettings,
} from "@/lib/config/settings-types";
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
  | "roteiro"
  | "partners";

const WIZARD_STEPS_PRODUCTION: Array<{ id: WizardStepId; label: string }> = [
  { id: "identity", label: "Nome e cor" },
  { id: "banks", label: "Bancos" },
  { id: "pessoais-config", label: "Config. dados pessoais" },
  { id: "pessoais", label: "Dados pessoais" },
  { id: "profissionais", label: "Dados profissionais" },
  { id: "financeiros", label: "Dados financeiros" },
  { id: "roteiro", label: "Roteiro Operacional" },
  { id: "partners", label: "Parceiros" },
];

/** Em Parceiros o produto já é só para parceiros — sem etapa Sim/Não. Roteiro é a última. */
const WIZARD_STEPS_PARTNERS: Array<{ id: WizardStepId; label: string }> = [
  { id: "identity", label: "Nome e cor" },
  { id: "banks", label: "Bancos" },
  { id: "pessoais-config", label: "Config. dados pessoais" },
  { id: "pessoais", label: "Dados pessoais" },
  { id: "profissionais", label: "Dados profissionais" },
  { id: "financeiros", label: "Dados financeiros" },
  { id: "roteiro", label: "Roteiro Operacional" },
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

type WizardFieldRow = {
  id: ClientFieldId;
  label: string;
  hint?: string;
  isCustom: boolean;
};

function fieldsForWizardStep(
  step: WizardStepId,
  customFields: ProductCustomField[],
): { title: string; groupId: ClientFieldGroupId | null; fields: WizardFieldRow[] } | null {
  const customOf = (groupId: ClientFieldGroupId) =>
    customFields
      .filter((field) => field.groupId === groupId)
      .map((field) => ({
        id: field.id,
        label: field.label,
        isCustom: true as const,
      }));

  const pessoais = CLIENT_FIELD_GROUPS.find((g) => g.id === "pessoais");
  if (step === "pessoais-config" && pessoais) {
    const idSet = new Set(PESSOAIS_CONFIG_FIELD_IDS);
    return {
      title: "Configurações dos Dados pessoais",
      groupId: "pessoais",
      fields: [
        ...pessoais.fields
          .filter((field) => idSet.has(field.id))
          .map((field) => ({ ...field, isCustom: false as const })),
        ...customOf("pessoais"),
      ],
    };
  }
  if (step === "pessoais" && pessoais) {
    const idSet = new Set(PESSOAIS_ADDRESS_FIELD_IDS);
    return {
      title: "Dados pessoais",
      groupId: "pessoais",
      fields: [
        ...pessoais.fields
          .filter((field) => idSet.has(field.id))
          .map((field) => ({ ...field, isCustom: false as const })),
      ],
    };
  }
  if (step === "profissionais") {
    const group = CLIENT_FIELD_GROUPS.find((g) => g.id === "profissionais");
    return group
      ? {
          title: group.title,
          groupId: "profissionais",
          fields: [
            ...group.fields.map((field) => ({ ...field, isCustom: false as const })),
            ...customOf("profissionais"),
          ],
        }
      : null;
  }
  if (step === "financeiros") {
    const group = CLIENT_FIELD_GROUPS.find((g) => g.id === "financeiros");
    return group
      ? {
          title: group.title,
          groupId: "financeiros",
          fields: [
            ...group.fields.map((field) => ({ ...field, isCustom: false as const })),
            ...customOf("financeiros"),
          ],
        }
      : null;
  }
  return null;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

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
  const { auth } = useRouteContext({ from: "/app" });
  const isMaster = auth.role === "master";
  const uploadGuide = useServerFn(uploadProductOperationalGuideFn);
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
  const [uploadingGuide, setUploadingGuide] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
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

  useEffect(() => {
    setNewFieldLabel("");
  }, [stepIndex, selectedId]);

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
                  customFields: local.customFields,
                  requiredFieldIds: local.requiredFieldIds,
                  availableFieldIds: local.availableFieldIds,
                  operationalGuideEnabled: local.operationalGuideEnabled,
                  operationalGuide: local.operationalGuide,
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

  const addCustomField = (groupId: ClientFieldGroupId) => {
    if (!selected || !isMaster) {
      toast.error("Apenas o usuário master pode adicionar campos.");
      return;
    }
    const label = newFieldLabel.trim();
    if (!label) {
      toast.error("Informe o nome do campo.");
      return;
    }
    const id = `custom-${crypto.randomUUID().slice(0, 10)}` as const;
    const customFields: ProductCustomField[] = [
      ...(selected.customFields ?? []),
      { id, label, groupId },
    ];
    setNewFieldLabel("");
    updateSelected({ customFields });
    toast.success("Campo adicionado como disponível.");
  };

  const removeCustomField = (fieldId: ClientFieldId) => {
    if (!selected || !isMaster || !isCustomClientFieldId(fieldId)) return;
    updateSelected({
      customFields: (selected.customFields ?? []).filter((field) => field.id !== fieldId),
      requiredFieldIds: selected.requiredFieldIds.filter((id) => id !== fieldId),
    });
  };

  const toggleBankId = (bankId: string, checked: boolean) => {
    if (!selected) return;
    const bankIds = checked
      ? [...new Set([...(selected.bankIds ?? []), bankId])]
      : (selected.bankIds ?? []).filter((id) => id !== bankId);
    updateSelected({ bankIds });
  };

  const handleGuideUpload = async (file: File | null) => {
    if (!file || !selected) return;
    if (!isMaster) {
      toast.error("Apenas o usuário master pode enviar roteiros.");
      return;
    }
    setUploadingGuide(true);
    try {
      const base64 = await fileToBase64(file);
      const uploaded = await uploadGuide({ data: { fileName: file.name, base64 } });
      updateSelected({
        operationalGuideEnabled: true,
        operationalGuide: {
          storageId: uploaded.storageId,
          fileName: uploaded.fileName,
          displayName:
            selected.operationalGuide?.displayName.trim() ||
            uploaded.fileName.replace(/\.pdf$/i, ""),
        },
      });
      toast.success("PDF do roteiro carregado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload do PDF.");
    } finally {
      setUploadingGuide(false);
    }
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
  const fieldStep = fieldsForWizardStep(currentStep.id, selected?.customFields ?? []);
  const canAddFieldsInStep =
    isMaster &&
    fieldStep?.groupId != null &&
    (currentStep.id === "pessoais-config" ||
      currentStep.id === "profissionais" ||
      currentStep.id === "financeiros");

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
                  {isMaster ? (
                    <>
                      {" "}
                      Master pode <strong className="text-foreground">adicionar campos</strong>{" "}
                      dinâmicos neste produto.
                    </>
                  ) : null}
                </div>
                <h3 className="text-sm font-semibold">{fieldStep.title}</h3>
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Campo</th>
                        <th className="w-28 px-4 py-2 text-center font-medium">Disponível</th>
                        <th className="w-28 px-4 py-2 text-center font-medium">Obrigatório</th>
                        {isMaster ? (
                          <th className="w-16 px-4 py-2 text-center font-medium">Ação</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {fieldStep.fields.map((field) => {
                        const required = selected.requiredFieldIds.includes(field.id);
                        const available = !required;
                        return (
                          <tr key={field.id} className="border-t border-border/60">
                            <td className="px-4 py-3">
                              <div className="font-medium">
                                {field.label}
                                {field.isCustom ? (
                                  <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                                    custom
                                  </span>
                                ) : null}
                              </div>
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
                            {isMaster ? (
                              <td className="px-4 py-3 text-center">
                                {field.isCustom ? (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    title="Remover campo"
                                    onClick={() => removeCustomField(field.id)}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                ) : null}
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {canAddFieldsInStep && fieldStep.groupId ? (
                  <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border/70 bg-muted/10 p-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label htmlFor="new-custom-field">Novo campo (master)</Label>
                      <Input
                        id="new-custom-field"
                        value={newFieldLabel}
                        onChange={(event) => setNewFieldLabel(event.target.value)}
                        placeholder="Ex.: Matrícula SIAPE"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addCustomField(fieldStep.groupId!);
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addCustomField(fieldStep.groupId!)}
                      disabled={saving}
                    >
                      <Plus className="size-4" /> Adicionar campo
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {currentStep.id === "roteiro" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Importe o PDF do Roteiro Operacional deste produto
                  {isPartnersCatalog
                    ? "."
                    : " (penúltima etapa, antes de Parceiros)."}
                </p>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={selected.operationalGuideEnabled}
                    onCheckedChange={(value) => {
                      const enabled = value === true;
                      updateSelected({
                        operationalGuideEnabled: enabled,
                        operationalGuide: enabled ? selected.operationalGuide : null,
                      });
                    }}
                  />
                  <span>
                    <span className="font-medium">Roteiro Operacional</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      PDF + nome de exibição
                    </span>
                  </span>
                </label>
                {selected.operationalGuideEnabled ? (
                  <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="product-guide-name">Nome de exibição</Label>
                      <Input
                        id="product-guide-name"
                        value={selected.operationalGuide?.displayName ?? ""}
                        onChange={(event) =>
                          patchSelectedLocal({
                            operationalGuide: {
                              storageId: selected.operationalGuide?.storageId ?? "",
                              fileName: selected.operationalGuide?.fileName ?? "",
                              displayName: event.target.value,
                            },
                          })
                        }
                        onBlur={() => persistSelectedQuiet()}
                        placeholder="Ex.: Roteiro FGTS"
                      />
                    </div>
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        disabled={!isMaster || uploadingGuide}
                        onChange={(event) =>
                          void handleGuideUpload(event.target.files?.[0] ?? null)
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        asChild
                        disabled={!isMaster || uploadingGuide}
                      >
                        <span>
                          <FileUp className="size-3.5" />
                          {uploadingGuide ? "Enviando…" : "Enviar PDF"}
                        </span>
                      </Button>
                    </label>
                    {!isMaster ? (
                      <p className="text-xs text-muted-foreground">
                        Somente master pode enviar o PDF do roteiro.
                      </p>
                    ) : null}
                    {selected.operationalGuide?.fileName ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Arquivo: {selected.operationalGuide.fileName}</span>
                        {selected.operationalGuide.storageId ? (
                          <a
                            className="text-primary underline-offset-2 hover:underline"
                            href={`/api/banks/guides/${selected.operationalGuide.storageId}`}
                            download={selected.operationalGuide.fileName || "roteiro.pdf"}
                          >
                            Baixar
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
                      <th className="px-4 py-3 text-center font-medium">Parceiros</th>
                    )}
                    <th className="px-4 py-3 text-right font-medium">Ação</th>
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
                          <td className="px-4 py-3 text-center">
                            <Checkbox
                              checked={row.availableForPartners}
                              disabled={saving}
                              onCheckedChange={(value) =>
                                setAvailableForPartners(row.productId, value === true)
                              }
                              aria-label={`Parceiros: ${row.productName}`}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Editar"
                              onClick={() => editProductFromList(row.productId)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              title="Excluir"
                              disabled={saving}
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
        open={Boolean(pendingDeleteIds?.length)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteIds(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialogCount > 1 ? "Excluir produtos?" : "Excluir produto?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialogCount > 1
                ? `Os ${deleteDialogCount} produtos selecionados serão removidos permanentemente.`
                : "Este produto será removido permanentemente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
