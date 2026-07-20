import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { listWabaAquecedorInstancesFn } from "@/lib/waba/waba-aquecedor.server";
import { createWabaAlternativaCampaignFn } from "@/lib/waba/waba-alternativa-campaign.server";
import {
  FUNNEL_DISPARO_WORKING_DAY_OPTIONS,
  normalizeFunnelWorkingDays,
  type FunnelDisparoConfig,
  type FunnelDisparoWorkingDay,
} from "@/lib/marketing/funnel.types";
import { cn } from "@/lib/utils";

export function FunnelDisparoModal({
  open,
  onOpenChange,
  value,
  audienceCount,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: FunnelDisparoConfig;
  audienceCount: number | null;
  onSave: (next: FunnelDisparoConfig) => void;
}) {
  const listInstances = useServerFn(listWabaAquecedorInstancesFn);
  const createCampaign = useServerFn(createWabaAlternativaCampaignFn);
  const [draft, setDraft] = useState<FunnelDisparoConfig>(value);
  const [instances, setInstances] = useState<Array<{ name: string; number: string }>>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next: FunnelDisparoConfig = {
      campaignName: value.campaignName || "",
      plannedSendCount:
        value.plannedSendCount > 0
          ? value.plannedSendCount
          : Math.max(0, audienceCount ?? 0),
      messageMode: "ai",
      aiBriefing: value.aiBriefing || "",
      aiTone: value.aiTone || "consultivo",
      aiCta: value.aiCta || "Responda no link abaixo",
      aiAudience: value.aiAudience || "CORBAN",
      linkDestinationMode: value.linkDestinationMode === "url" ? "url" : "whatsapp",
      whatsappTargetNumber: value.whatsappTargetNumber || "",
      responseUrl: value.responseUrl || "",
      startHour: value.startHour ?? 8,
      endHour: value.endHour ?? 22,
      workingDays: normalizeFunnelWorkingDays(value.workingDays),
      selectedInstanceNames: value.selectedInstanceNames || [],
      wabaCampaignId: value.wabaCampaignId,
      lastGenerateError: value.lastGenerateError,
    };
    setDraft(next);
  }, [open, value, audienceCount]);

  useEffect(() => {
    if (!open) return;
    setLoadingInstances(true);
    void listInstances()
      .then((result) => {
        if (!result.ok) {
          toast.message(result.error || "Não foi possível listar instâncias WABA");
          setInstances([]);
          return;
        }
        setInstances(
          (result.items || []).map((item) => ({
            name: item.instanceName,
            number: item.number,
          })),
        );
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Falha ao listar instâncias");
        setInstances([]);
      })
      .finally(() => setLoadingInstances(false));
  }, [open, listInstances]);

  const instanceOptions = useMemo(
    () =>
      instances.map((item) => ({
        value: item.name,
        label: item.number ? `${item.name} · ${item.number}` : item.name,
      })),
    [instances],
  );

  /** [] = Todos (todas as instâncias conectadas). */
  function resolveSelectedInstances(names: string[]): string[] {
    if (names.length === 0) return instances.map((item) => item.name);
    return names.filter((name) => instances.some((item) => item.name === name));
  }

  function patch(partial: Partial<FunnelDisparoConfig>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function toggleWorkingDay(day: FunnelDisparoWorkingDay, checked: boolean) {
    setDraft((current) => {
      const currentDays = normalizeFunnelWorkingDays(current.workingDays, { allowEmpty: true });
      const set = new Set(currentDays);
      if (checked) set.add(day);
      else set.delete(day);
      const next = FUNNEL_DISPARO_WORKING_DAY_OPTIONS.map((d) => d.id).filter((id) =>
        set.has(id),
      );
      return { ...current, workingDays: next };
    });
  }

  async function handleGenerate() {
    if (!draft.campaignName.trim()) {
      toast.error("Informe o nome da campanha.");
      return;
    }
    if (draft.plannedSendCount <= 0) {
      toast.error("Informe a quantidade planejada de envios.");
      return;
    }
    if (normalizeFunnelWorkingDays(draft.workingDays, { allowEmpty: true }).length === 0) {
      toast.error("Selecione ao menos um dia de expediente.");
      return;
    }
    const selectedInstances = resolveSelectedInstances(draft.selectedInstanceNames);
    if (selectedInstances.length === 0) {
      toast.error("Nenhuma instância conectada disponível.");
      return;
    }
    if (draft.linkDestinationMode === "whatsapp" && !draft.whatsappTargetNumber.trim()) {
      toast.error("Informe o WhatsApp de resposta.");
      return;
    }
    if (draft.linkDestinationMode === "url" && !draft.responseUrl.trim()) {
      toast.error("Informe a URL de resposta.");
      return;
    }

    const payload: FunnelDisparoConfig = {
      ...draft,
      workingDays: normalizeFunnelWorkingDays(draft.workingDays),
      selectedInstanceNames: selectedInstances,
    };

    setGenerating(true);
    try {
      const result = await createCampaign({ data: payload });
      if (!result.ok) {
        const next = { ...payload, lastGenerateError: result.error || "Falha ao gerar campanha" };
        setDraft(next);
        toast.error(next.lastGenerateError);
        return;
      }
      const next: FunnelDisparoConfig = {
        ...payload,
        // Mantém [] no draft se era "Todos", só envia a lista resolvida na API
        selectedInstanceNames:
          draft.selectedInstanceNames.length === 0 ? [] : selectedInstances,
        wabaCampaignId: result.campaignId || null,
        lastGenerateError: null,
      };
      setDraft(next);
      onSave(next);
      toast.success(
        result.message ||
          "Campanha enviada ao WABA (mozart.pmo@gmail.com). O fluxo de envio segue no painel.",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar campanha");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex z-[200] max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col gap-4 overflow-hidden"
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
            <Megaphone className="size-4" />
            Disparo · API Alternativa (WABA)
          </DialogTitle>
          <DialogDescription>
            Envie só os dados iniciais da campanha. Delay e ritmo de envio são calculados
            automaticamente no WABA; o restante do fluxo segue no painel de lá.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome da campanha</Label>
              <Input
                value={draft.campaignName}
                onChange={(event) => patch({ campaignName: event.target.value })}
                placeholder="Ex.: Prospecção CLT — julho"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Qtd. planejada de envios</Label>
              <Input
                type="number"
                min={1}
                value={draft.plannedSendCount || ""}
                onChange={(event) =>
                  patch({ plannedSendCount: Math.max(0, Number(event.target.value) || 0) })
                }
              />
              {audienceCount != null ? (
                <p className="text-[11px] text-muted-foreground">
                  Público do passo anterior: {audienceCount.toLocaleString("pt-BR")}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Público-alvo (IA)</Label>
              <Input
                value={draft.aiAudience}
                onChange={(event) => patch({ aiAudience: event.target.value })}
                placeholder="CORBAN"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Briefing da IA</Label>
              <Textarea
                value={draft.aiBriefing}
                onChange={(event) => patch({ aiBriefing: event.target.value })}
                placeholder="Contexto do produto, tom e objetivo do disparo…"
                className="min-h-[90px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tom</Label>
              <Input
                value={draft.aiTone}
                onChange={(event) => patch({ aiTone: event.target.value })}
                placeholder="consultivo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CTA</Label>
              <Input
                value={draft.aiCta}
                onChange={(event) => patch({ aiCta: event.target.value })}
                placeholder="Responda no link abaixo"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label>Destino da resposta (link encurtado)</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={draft.linkDestinationMode === "whatsapp" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => patch({ linkDestinationMode: "whatsapp" })}
              >
                WhatsApp
              </Button>
              <Button
                type="button"
                size="sm"
                variant={draft.linkDestinationMode === "url" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => patch({ linkDestinationMode: "url" })}
              >
                URL
              </Button>
            </div>
            {draft.linkDestinationMode === "whatsapp" ? (
              <Input
                value={draft.whatsappTargetNumber}
                onChange={(event) => patch({ whatsappTargetNumber: event.target.value })}
                placeholder="Ex.: 51999999999"
              />
            ) : (
              <Input
                value={draft.responseUrl}
                onChange={(event) => patch({ responseUrl: event.target.value })}
                placeholder="https://…"
              />
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <Label className="text-sm font-medium text-sky-300">Expediente</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Início da janela (hora)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={draft.startHour}
                  onChange={(event) => patch({ startHour: Number(event.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fim da janela (hora)</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={draft.endHour}
                  onChange={(event) => patch({ endHour: Number(event.target.value) || 22 })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {FUNNEL_DISPARO_WORKING_DAY_OPTIONS.map((day) => {
                const checked = normalizeFunnelWorkingDays(draft.workingDays, {
                  allowEmpty: true,
                }).includes(day.id);
                return (
                  <label
                    key={day.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 text-sm text-foreground",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleWorkingDay(day.id, value === true)}
                    />
                    {day.label}
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              O WABA só dispara nos dias marcados, dentro desta janela. O intervalo entre envios é
              calculado automaticamente.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Instâncias conectadas (aquecedor)</Label>
            {loadingInstances ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Carregando…
              </p>
            ) : instances.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma instância conectada disponível.</p>
            ) : (
              <>
                <MultiSelectFilter
                  allLabel="Todos"
                  options={instanceOptions}
                  values={draft.selectedInstanceNames}
                  onChange={(selectedInstanceNames) => patch({ selectedInstanceNames })}
                  modal
                  contentClassName="z-[250]"
                  className="w-full sm:w-full max-w-xl"
                  emptyLabel="Nenhuma instância conectada"
                />
                <p className="text-[11px] text-muted-foreground">
                  {draft.selectedInstanceNames.length === 0
                    ? `Todos · ${instances.length} instância(s) serão usadas no disparo`
                    : `${draft.selectedInstanceNames.length} de ${instances.length} selecionada(s)`}
                </p>
              </>
            )}
          </div>

          {draft.wabaCampaignId ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Campanha WABA: {draft.wabaCampaignId}
            </p>
          ) : null}
          {draft.lastGenerateError ? (
            <p className="text-xs text-destructive">{draft.lastGenerateError}</p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Salvar rascunho
          </Button>
          <Button
            type="button"
            className="cursor-pointer gap-1.5"
            disabled={generating}
            onClick={() => void handleGenerate()}
          >
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Megaphone className="size-3.5" />}
            Gerar Campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
