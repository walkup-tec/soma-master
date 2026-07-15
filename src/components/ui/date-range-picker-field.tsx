import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatDateRangeLabelBr,
  formatIsoDateLocal,
  parseIsoDateLocal,
} from "@/lib/dates/date-picker";
import { cn } from "@/lib/utils";

type Props = {
  from?: string;
  to?: string;
  onChange: (next: { from: string; to: string }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/** Período (início–fim) selecionado no calendário. Valores em YYYY-MM-DD. */
export function DateRangePickerField({
  from,
  to,
  onChange,
  placeholder = "Data de criação",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected: DateRange | undefined =
    from || to
      ? {
          from: parseIsoDateLocal(from),
          to: parseIsoDateLocal(to),
        }
      : undefined;

  const label = formatDateRangeLabelBr(from, to);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-9 min-w-[14rem] flex-1 justify-start gap-2 px-3 text-left font-normal",
              !label && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4 shrink-0 opacity-70" />
            <span className="truncate">{label || placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={selected}
            defaultMonth={selected?.from ?? selected?.to}
            captionLayout="dropdown"
            onSelect={(range) => {
              const nextFrom = formatIsoDateLocal(range?.from);
              const nextTo = formatIsoDateLocal(range?.to ?? range?.from);
              onChange({ from: nextFrom, to: nextTo });
              if (range?.from && range?.to) setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {from || to ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-9 shrink-0"
          disabled={disabled}
          aria-label="Limpar período"
          onClick={() => onChange({ from: "", to: "" })}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
