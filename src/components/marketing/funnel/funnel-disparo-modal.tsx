import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Megaphone } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listWabaAquecedorInstancesFn } from "@/lib/waba/waba-aquecedor.server";
import { createWabaAlternativaCampaignFn } from "@/lib/waba/waba-alternativa-campaign.server";
import type { FunnelDisparoConfig } from "@/lib/marketing/funnel.types";
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
    const next = {
      ...value,
      plannedSendCount:
        value.plannedSendCount > 0
          ? value.plannedSendCount
          : Math.max(0, audienceCount ?? 0),
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

  function patch(partial: Partial<FunnelDisparoConfig>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function toggleInstance(name: string) {
    setDraft((current) => {
      const selected = new Set(current.selectedInstanceNames);
      if (selected.has(name)) selected.delete(name);
      else selected.add(name);
      return { ...current, selectedInstanceNames: [...selected] };
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
    if (draft.selectedInstanceNames.length === 0) {
      toast.error("Selecione ao menos uma instância conectada.");
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

    setGenerating(true);
    try {
      const result = await createCampaign({ data: draft });
      if (!result.ok) {
        const next = { ...draft, lastGenerateError: result.error || "Falha ao gerar campanha" };
        setDraft(next);
        toast.error(next.lastGenerateError);
        return;
      }
      const next: FunnelDisparoConfig = {
        ...draft,
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
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="size-4" />
            Disparo · API Alternativa (WABA)
          </DialogTitle>
          <DialogDescription>
            Mesma lógica de criação de campanha Alternativa. Ao gerar, os dados vão para a conta
            WABA configurada e o envio segue o fluxo normal de lá.
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
              <Label>Modo da mensagem</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={draft.messageMode === "ai" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => patch({ messageMode: "ai" })}
                >
                  IA
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={draft.messageMode === "fixed" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => patch({ messageMode: "fixed" })}
                >
                  Texto fixo
                </Button>
              </div>
            </div>
          </div>

          {draft.messageMode === "ai" ? (
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
          ) : (
            <div className="space-y-1.5">
              <Label>Mensagem fixa</Label>
              <Textarea
                value={draft.fixedMessage}
                onChange={(event) => patch({ fixedMessage: event.target.value })}
                className="min-h-[110px]"
              />
            </div>
          )}

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

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Delay mín. (s)</Label>
              <Input
                type="number"
                value={draft.delayMinSeconds}
                onChange={(event) => patch({ delayMinSeconds: Number(event.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Delay máx. (s)</Label>
              <Input
                type="number"
                value={draft.delayMaxSeconds}
                onChange={(event) => patch({ delayMaxSeconds: Number(event.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Início (h)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={draft.startHour}
                onChange={(event) => patch({ startHour: Number(event.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fim (h)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={draft.endHour}
                onChange={(event) => patch({ endHour: Number(event.target.value) || 0 })}
              />
            </div>
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
              <div className="grid max-h-40 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {instances.map((item) => {
                  const selected = draft.selectedInstanceNames.includes(item.name);
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => toggleInstance(item.name)}
                      className={cn(
                        "cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                        {item.number || "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
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
