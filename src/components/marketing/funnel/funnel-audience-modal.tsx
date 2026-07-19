import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, Loader2, Tags, Users } from "lucide-react";
import * as XLSX from "xlsx";
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
import { Input } from "@/components/ui/input";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { countBulkClientsFn } from "@/lib/clients/clients.server";
import type { ClientAttendanceFilter, ClientBulkFilters } from "@/lib/clients/client.types";
import {
  resolveRegistrationDateRange,
  type RegistrationDatePreset,
} from "@/lib/dates/local-date";
import type { FunnelAudienceConfig } from "@/lib/marketing/funnel.types";
import type { AttendanceStatusConfig, ProductConfig } from "@/lib/config/settings-types";
import { cn } from "@/lib/utils";

const DATE_PRESETS: Array<{ id: RegistrationDatePreset; label: string }> = [
  { id: "all", label: "Todo período" },
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "week", label: "7 dias" },
  { id: "15", label: "15 dias" },
  { id: "30", label: "30 dias" },
];

export function FunnelAudienceModal({
  open,
  onOpenChange,
  value,
  onSave,
  products,
  attendanceStatuses,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: FunnelAudienceConfig;
  onSave: (next: FunnelAudienceConfig) => void;
  products: ProductConfig[];
  attendanceStatuses: AttendanceStatusConfig[];
}) {
  const countBulk = useServerFn(countBulkClientsFn);
  const [draft, setDraft] = useState<FunnelAudienceConfig>(value);
  const [counting, setCounting] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [datePreset, setDatePreset] = useState<RegistrationDatePreset>("all");

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setTagInput("");
  }, [open, value]);

  useEffect(() => {
    if (!open || draft.source !== "filters") return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCounting(true);
      void countBulk({
        data: { mode: "filter", filters: draft.filters },
      })
        .then((result) => {
          if (cancelled) return;
          setDraft((current) => ({ ...current, audienceCount: result.total }));
        })
        .catch(() => {
          if (!cancelled) setDraft((current) => ({ ...current, audienceCount: null }));
        })
        .finally(() => {
          if (!cancelled) setCounting(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, draft.source, draft.filters, countBulk]);

  const productOptions = useMemo(
    () => products.map((item) => ({ value: item.id, label: item.name })),
    [products],
  );
  const statusOptions = useMemo(
    () => attendanceStatuses.map((item) => ({ value: item.id, label: item.label })),
    [attendanceStatuses],
  );

  function patchFilters(patch: Partial<ClientBulkFilters>) {
    setDraft((current) => ({
      ...current,
      source: "filters",
      filters: { ...current.filters, ...patch },
    }));
  }

  function addTag() {
    const tag = tagInput.trim();
    if (!tag) return;
    if (draft.tags.includes(tag)) {
      setTagInput("");
      return;
    }
    setDraft((current) => ({ ...current, tags: [...current.tags, tag] }));
    setTagInput("");
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      setDraft((current) => ({
        ...current,
        source: "import",
        importFileName: file.name,
        importRowCount: rows.length,
        audienceCount: rows.length,
      }));
      toast.success(`${rows.length.toLocaleString("pt-BR")} linhas lidas de ${file.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao ler a planilha");
    }
  }

  const displayCount =
    draft.source === "import"
      ? draft.importRowCount
      : draft.audienceCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex z-[200] max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-4 overflow-hidden"
        overlayClassName="z-[200]"
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-radix-popper-content-wrapper], [data-slot=popover-content]")) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-radix-popper-content-wrapper], [data-slot=popover-content]")) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4" />
            Público do funil
          </DialogTitle>
          <DialogDescription>
            Filtre clientes do CRM, use tags (em breve no cadastro) ou importe uma planilha. A
            contagem ajuda a dimensionar o disparo.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Público estimado: </span>
          {counting ? (
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Loader2 className="size-3.5 animate-spin" /> calculando…
            </span>
          ) : (
            <span className="font-semibold tabular-nums text-foreground">
              {displayCount == null ? "—" : displayCount.toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        <Tabs
          value={draft.source}
          onValueChange={(next) =>
            setDraft((current) => ({
              ...current,
              source: next as FunnelAudienceConfig["source"],
            }))
          }
          className="min-h-0 flex-1 overflow-hidden"
        >
          <TabsList>
            <TabsTrigger value="filters">Filtros CRM</TabsTrigger>
            <TabsTrigger value="import">Importar arquivo</TabsTrigger>
          </TabsList>

          <TabsContent value="filters" className="mt-3 max-h-[48vh] space-y-3 overflow-y-auto pr-1">
            <Input
              placeholder="Buscar nome, CPF ou telefone…"
              value={draft.filters.search ?? ""}
              onChange={(event) => patchFilters({ search: event.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              <MultiSelectFilter
                allLabel="Todos os produtos"
                options={productOptions}
                values={draft.filters.productIds ?? []}
                onChange={(productIds) => patchFilters({ productIds })}
                modal
                contentClassName="z-[250]"
                emptyLabel="Nenhum produto cadastrado nas configurações"
              />
              <MultiSelectFilter
                allLabel="Todos os status"
                options={statusOptions}
                values={draft.filters.statuses ?? []}
                onChange={(statuses) => patchFilters({ statuses })}
                modal
                contentClassName="z-[250]"
                emptyLabel="Nenhum status cadastrado nas configurações"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant={datePreset === preset.id ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    setDatePreset(preset.id);
                    const range = resolveRegistrationDateRange(preset.id);
                    patchFilters({
                      createdFrom: range.from || undefined,
                      createdTo: range.to || undefined,
                    });
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Atendimento: todos"],
                  ["with", "Com atendimento"],
                  ["without", "Sem atendimento"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={draft.filters.attendance === value ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => patchFilters({ attendance: value as ClientAttendanceFilter })}
                >
                  {label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={draft.filters.schedule === "with" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() =>
                  patchFilters({
                    schedule: draft.filters.schedule === "with" ? "all" : "with",
                  })
                }
              >
                Com agenda
              </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Tags className="size-4 text-muted-foreground" />
                Tags
                <span className="text-[11px] font-normal text-muted-foreground">
                  (recurso em criação no CRM — já pode montar a lista)
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  placeholder="Digite uma tag e Enter"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button type="button" variant="secondary" className="cursor-pointer" onClick={addTag}>
                  Adicionar
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {draft.tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma tag selecionada.</p>
                ) : (
                  draft.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="cursor-pointer rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          tags: current.tags.filter((item) => item !== tag),
                        }))
                      }
                      title="Remover tag"
                    >
                      {tag} ×
                    </button>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="import" className="mt-3 space-y-3">
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center transition-colors hover:bg-muted/40",
              )}
            >
              <FileSpreadsheet className="size-8 text-muted-foreground" />
              <span className="text-sm font-medium">Selecionar planilha Excel</span>
              <span className="text-xs text-muted-foreground">
                Contamos as linhas para estimar o público do disparo.
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(event) => void onImportFile(event.target.files?.[0])}
              />
            </label>
            {draft.importFileName ? (
              <p className="text-sm text-muted-foreground">
                Arquivo: <span className="font-medium text-foreground">{draft.importFileName}</span>
                {draft.importRowCount != null
                  ? ` · ${draft.importRowCount.toLocaleString("pt-BR")} linhas`
                  : null}
              </p>
            ) : null}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Aplicar público
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
