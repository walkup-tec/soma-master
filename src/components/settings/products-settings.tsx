import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLIENT_FIELD_GROUPS, type ClientFieldId } from "@/lib/config/client-fields";
import { createEmptyProduct } from "@/lib/config/settings-defaults";
import type { ProductConfig, SystemSettings } from "@/lib/config/settings-types";

type Props = {
  settings: SystemSettings;
  onChange: (settings: SystemSettings) => void;
};

export function ProductsSettings({ settings, onChange }: Props) {
  const [selectedId, setSelectedId] = useState(settings.products[0]?.id ?? "");
  const selected = settings.products.find((p) => p.id === selectedId) ?? settings.products[0];

  const updateProducts = (products: ProductConfig[]) => {
    onChange({ ...settings, products });
  };

  const updateSelected = (patch: Partial<ProductConfig>) => {
    if (!selected) return;
    updateProducts(settings.products.map((p) => (p.id === selected.id ? { ...p, ...patch } : p)));
  };

  const toggleField = (fieldId: ClientFieldId, mode: "available" | "required", checked: boolean) => {
    if (!selected) return;

    let availableFieldIds = [...selected.availableFieldIds];
    let requiredFieldIds = [...selected.requiredFieldIds];

    if (mode === "available") {
      if (checked) {
        if (!availableFieldIds.includes(fieldId)) availableFieldIds.push(fieldId);
      } else {
        availableFieldIds = availableFieldIds.filter((id) => id !== fieldId);
        requiredFieldIds = requiredFieldIds.filter((id) => id !== fieldId);
      }
    } else if (checked) {
      if (!availableFieldIds.includes(fieldId)) availableFieldIds.push(fieldId);
      if (!requiredFieldIds.includes(fieldId)) requiredFieldIds.push(fieldId);
    } else {
      requiredFieldIds = requiredFieldIds.filter((id) => id !== fieldId);
    }

    updateSelected({ availableFieldIds, requiredFieldIds });
  };

  const addProduct = () => {
    const product = createEmptyProduct();
    product.name = "Novo produto";
    updateProducts([...settings.products, product]);
    setSelectedId(product.id);
  };

  const removeProduct = (id: string) => {
    const products = settings.products.filter((p) => p.id !== id);
    if (products.length === 0) {
      toast.error("Mantenha ao menos um produto.");
      return;
    }
    updateProducts(products);
    setSelectedId(products[0].id);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="border-border/60 shadow-soft h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Produtos</CardTitle>
          <CardDescription>Campos exigidos no cadastro de cliente por produto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {settings.products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => setSelectedId(product.id)}
              className={`flex w-full flex-col rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selected?.id === product.id
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/60 hover:bg-muted/50"
              }`}
            >
              <span className="font-medium">{product.name || "Sem nome"}</span>
              <span className="text-xs text-muted-foreground">
                {product.requiredFieldIds.length} obrigatório(s) · {product.availableFieldIds.length} disponível(is)
              </span>
            </button>
          ))}
          <Button type="button" variant="outline" className="w-full" onClick={addProduct}>
            <Plus className="size-4" /> Novo produto
          </Button>
        </CardContent>
      </Card>

      {selected ? (
        <Card className="border-border/60 shadow-soft">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="font-display text-base">Editar produto</CardTitle>
              <CardDescription>
                Campos disponíveis e obrigatórios ao cadastrar cliente neste produto.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => removeProduct(selected.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 max-w-md">
              <Label htmlFor="product-name">Nome do produto</Label>
              <Input
                id="product-name"
                value={selected.name}
                onChange={(e) => updateSelected({ name: e.target.value })}
                placeholder="Ex.: Empréstimo CLT, FGTS, Cartão consignado"
              />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              Marque <strong className="text-foreground">Disponível</strong> para liberar o campo no cadastro.
              Marque <strong className="text-foreground">Obrigatório</strong> para exigir o preenchimento (somente entre
              os disponíveis).
            </div>

            <div className="space-y-6">
              {CLIENT_FIELD_GROUPS.map((group) => (
                <div key={group.id} className="space-y-3">
                  <h3 className="text-sm font-semibold">{group.title}</h3>
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
                        {group.fields.map((field) => {
                          const available = selected.availableFieldIds.includes(field.id);
                          const required = selected.requiredFieldIds.includes(field.id);
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
                                  onCheckedChange={(value) => toggleField(field.id, "available", value === true)}
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Checkbox
                                  checked={required}
                                  disabled={!available}
                                  onCheckedChange={(value) => toggleField(field.id, "required", value === true)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
