import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatDateLabelBr,
  formatIsoDateLocal,
  parseIsoDateLocal,
} from "@/lib/dates/date-picker";
import { cn } from "@/lib/utils";

type Props = {
  value?: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  allowClear?: boolean;
};

/** Seletor de data via calendário. `value`/`onChange` usam YYYY-MM-DD. */
export function DatePickerField({
  value,
  onChange,
  placeholder = "Selecionar data",
  disabled,
  className,
  id,
  allowClear = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDateLocal(value);
  const label = formatDateLabelBr(value);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-9 min-w-[11rem] flex-1 justify-start gap-2 px-3 text-left font-normal",
              !label && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4 shrink-0 opacity-70" />
            <span className="truncate">{label || placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            captionLayout="dropdown"
            onSelect={(date) => {
              if (!date) return;
              onChange(formatIsoDateLocal(date));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {allowClear && value ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-9 shrink-0"
          disabled={disabled}
          aria-label="Limpar data"
          onClick={() => onChange("")}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
