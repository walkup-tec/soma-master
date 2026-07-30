import { useMemo, useRef } from "react";
import { Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clientFieldLabel } from "@/lib/config/client-fields";
import type { ProductConfig } from "@/lib/config/settings-types";

export type FlowVariableOption = {
  id: string;
  label: string;
  hint?: string;
};

function insertTokenAtCursor(
  el: HTMLTextAreaElement | null,
  current: string,
  token: string,
): { next: string; selectionStart: number } {
  if (!el) {
    const next = `${current}${current && !current.endsWith(" ") ? " " : ""}${token}`;
    return { next, selectionStart: next.length };
  }
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const before = current.slice(0, start);
  const after = current.slice(end);
  const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
  const needsSpaceAfter = after.length > 0 && !/^\s/.test(after);
  const piece = `${needsSpaceBefore ? " " : ""}${token}${needsSpaceAfter ? " " : ""}`;
  const next = `${before}${piece}${after}`;
  return { next, selectionStart: before.length + piece.length };
}

/**
 * Texto da Mensagem com inserção intuitiva de campos (produto + variáveis do fluxo).
 */
export function BotMessageTextEditor({
  value,
  onChange,
  products,
  productId,
  onProductIdChange,
  scopeRequired,
  scopeOptional,
  onScopeChange,
  flowVariables,
}: {
  value: string;
  onChange: (next: string) => void;
  products: ProductConfig[];
  productId: string;
  onProductIdChange: (productId: string) => void;
  scopeRequired: boolean;
  scopeOptional: boolean;
  onScopeChange: (patch: { required?: boolean; optional?: boolean }) => void;
  flowVariables: FlowVariableOption[];
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) || null,
    [products, productId],
  );

  const fieldOptions = useMemo(() => {
    if (!selectedProduct) return [] as Array<{ id: string; label: string }>;
    const ids: string[] = [];
    if (scopeRequired) ids.push(...(selectedProduct.requiredFieldIds || []));
    if (scopeOptional) ids.push(...(selectedProduct.availableFieldIds || []));
    const unique = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
    return unique.map((id) => ({
      id,
      label: clientFieldLabel(id, selectedProduct.customFields),
    }));
  }, [selectedProduct, scopeRequired, scopeOptional]);

  function insertField(fieldId: string) {
    const token = `{{${fieldId}}}`;
    const { next, selectionStart } = insertTokenAtCursor(
      textareaRef.current,
      value || "",
      token,
    );
    onChange(next);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selectionStart, selectionStart);
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Texto</Label>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          placeholder='Ex.: Olá! {{nome}}, como posso ajudar?'
          className="font-normal"
        />
        <p className="text-[11px] text-muted-foreground">
          Use o seletor abaixo para inserir campos — não é preciso digitar as chaves.
        </p>
      </div>

      {flowVariables.length > 0 ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Variáveis do fluxo</Label>
          <div className="flex flex-wrap gap-1.5">
            {flowVariables.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 cursor-pointer gap-1 px-2 text-xs"
                onClick={() => insertField(item.id)}
                title={item.hint || item.id}
              >
                <Braces className="size-3 opacity-70" />
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/15 p-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Braces className="size-3.5 text-primary" />
          Inserir campo do lead
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="msg-product">Produto</Label>
          <select
            id="msg-product"
            className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm"
            value={productId}
            onChange={(event) => onProductIdChange(event.target.value)}
          >
            <option value="">Selecione o produto…</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>

        {productId ? (
          <div className="space-y-2">
            <Label>Filtro dos campos</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={scopeRequired}
                  onCheckedChange={(checked) => onScopeChange({ required: checked === true })}
                />
                Obrigatórios
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={scopeOptional}
                  onCheckedChange={(checked) => onScopeChange({ optional: checked === true })}
                />
                Opcionais
              </label>
            </div>
          </div>
        ) : null}

        {productId && (scopeRequired || scopeOptional) ? (
          <div className="space-y-1.5">
            <Label>Campos — clique para inserir</Label>
            {fieldOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum campo neste filtro.</p>
            ) : (
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {fieldOptions.map((field) => (
                  <Button
                    key={field.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 cursor-pointer px-2 text-xs"
                    onClick={() => insertField(field.id)}
                  >
                    {field.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
