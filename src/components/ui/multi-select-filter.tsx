import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
};

type Props = {
  allLabel: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  className?: string;
  disabled?: boolean;
  emptyLabel?: string;
};

function summaryLabel(allLabel: string, options: MultiSelectOption[], values: string[]) {
  if (values.length === 0) return allLabel;
  if (values.length === 1) {
    return options.find((option) => option.value === values[0])?.label ?? "1 selecionado";
  }
  return `${values.length} selecionados`;
}

export function MultiSelectFilter({
  allLabel,
  options,
  values,
  onChange,
  className,
  disabled,
  emptyLabel = "Nenhuma opção",
}: Props) {
  const selected = new Set(values);

  const toggle = (value: string, checked: boolean) => {
    if (checked) {
      onChange([...values, value]);
      return;
    }
    onChange(values.filter((item) => item !== value));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between font-normal sm:w-[220px]",
            values.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{summaryLabel(allLabel, options, values)}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-2" align="start">
        {values.length > 0 ? (
          <div className="mb-1 flex justify-end px-1 pb-1">
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => onChange([])}
            >
              Limpar ({allLabel})
            </button>
          </div>
        ) : null}
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            options.map((option) => {
              const checked = selected.has(option.value);
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(state) => toggle(option.value, state === true)}
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
