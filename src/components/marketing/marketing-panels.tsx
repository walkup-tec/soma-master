import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Filter,
  Flame,
  Loader2,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FunnelBuilderModal,
  deleteStoredFunnel,
  listStoredFunnels,
} from "@/components/marketing/funnel/funnel-builder-modal";
import { listWabaAquecedorInstancesFn } from "@/lib/waba/waba-aquecedor.server";
import {
  wabaAvatarProxyUrl,
  type WabaAquecedorInstance,
} from "@/lib/waba/waba-aquecedor.adapter";
import {
  addSomaAlternativaCampaignInstancesFn,
  deleteSomaAlternativaCampaignFn,
  listSomaAlternativaCampaignsFn,
  renameSomaAlternativaCampaignFn,
  setSomaAlternativaCampaignActiveFn,
} from "@/lib/waba/waba-alternativa-campaign.server";
import type { SomaAlternativaCampaign } from "@/lib/waba/waba-alternativa-campaign.adapter";
import type { FunnelDraft } from "@/lib/marketing/funnel.types";
import { cn } from "@/lib/utils";

const REFRESH_MS = 45_000;

function formatCount(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR");
}

function WarmthFlames({ level, label }: { level: number; label: string }) {
  const lit = Math.max(0, Math.min(3, Math.floor(level)));
  return (
    <div className="flex items-center gap-0.5" title={label}>
      {[1, 2, 3].map((step) => (
        <Flame
          key={step}
          className={cn(
            "size-4",
            step <= lit
              ? "fill-orange-500 text-orange-500"
              : "fill-transparent text-muted-foreground/35",
          )}
          aria-hidden
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

function InstanceAvatar({ item }: { item: WabaAquecedorInstance }) {
  const src = wabaAvatarProxyUrl(item.profilePicUrl);
  const initial = (item.whatsappName || item.instanceName || "?").slice(0, 1).toUpperCase();
  if (!src) {
    return (
      <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {initial}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="size-9 rounded-full object-cover ring-1 ring-border/60"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

export function MarketingWhatsAppNumbersPanel() {
  const listInstances = useServerFn(listWabaAquecedorInstancesFn);
  const [items, setItems] = useState<WabaAquecedorInstance[]>([]);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listInstances();
      if (!result.ok) {
        setError(result.error || "Não foi possível carregar as instâncias.");
        setItems([]);
        return;
      }
      setError(null);
      setOwnerEmail(result.ownerEmail || "");
      setItems(result.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar Números WhatsApp.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [listInstances]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="font-display text-base">Números WhatsApp</CardTitle>
          <CardDescription>
            Instâncias <span className="text-foreground">conectadas</span> do aquecedor WABA
            {ownerEmail ? (
              <>
                {" "}
                · conta <span className="text-foreground">{ownerEmail}</span>
              </>
            ) : null}
            . Desconectadas não aparecem nesta lista.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            void refresh().then(() => toast.success("Lista atualizada."));
          }}
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Quente</TableHead>
                  <TableHead className="w-14" />
                  <TableHead>Número</TableHead>
                  <TableHead>Nome (WhatsApp)</TableHead>
                  <TableHead>Nome da Instância</TableHead>
                  <TableHead className="text-right">Contatos</TableHead>
                  <TableHead className="text-right">Mensagens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                      Carregando instâncias do aquecedor…
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                      Nenhuma instância conectada no aquecedor desta conta.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.instanceName}>
                      <TableCell>
                        <WarmthFlames level={item.warmthLevel} label={item.warmthLabel} />
                      </TableCell>
                      <TableCell>
                        <InstanceAvatar item={item} />
                      </TableCell>
                      <TableCell className="font-mono text-sm tabular-nums">
                        {item.number || "—"}
                      </TableCell>
                      <TableCell className="font-medium">{item.whatsappName || "—"}</TableCell>
                      <TableCell>{item.instanceAlias || item.instanceName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCount(item.contacts)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCount(item.messages)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MarketingFunnelPanel() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<FunnelDraft | null>(null);
  const [funnels, setFunnels] = useState<FunnelDraft[]>([]);
  const [funnelPendingDelete, setFunnelPendingDelete] = useState<FunnelDraft | null>(null);

  const reload = useCallback(() => {
    setFunnels(listStoredFunnels());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function confirmDeleteFunnel() {
    const funnel = funnelPendingDelete;
    if (!funnel) return;
    if (!deleteStoredFunnel(funnel.id)) {
      toast.error("Não foi possível excluir o funil.");
      setFunnelPendingDelete(null);
      return;
    }
    if (editing?.id === funnel.id) {
      setEditing(null);
      setBuilderOpen(false);
    }
    setFunnelPendingDelete(null);
    reload();
    toast.success("Funil excluído");
  }

  return (
    <>
      <Card className="border-border/60 shadow-soft">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="font-display text-base">Funis de prospecção</CardTitle>
            <CardDescription>
              Monte jornadas com Iniciar, Pausa, Público, Disparo (WABA), Feedback, E-mail Mkt e Fim.
              Arraste e conecte etapas em tela cheia.
            </CardDescription>
          </div>
          <Button
            type="button"
            className="cursor-pointer gap-1.5"
            onClick={() => {
              setEditing(null);
              setBuilderOpen(true);
            }}
          >
            <Plus className="size-4" />
            Novo Funil
          </Button>
        </CardHeader>
        <CardContent>
          {funnels.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
              <Filter className="size-10 text-muted-foreground/50" aria-hidden />
              <div>
                <p className="font-medium text-foreground">Nenhum funil ainda</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Clique em <span className="font-medium text-foreground">Novo Funil</span> para abrir
                  o construtor em tela cheia.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="cursor-pointer gap-1.5"
                onClick={() => {
                  setEditing(null);
                  setBuilderOpen(true);
                }}
              >
                <Plus className="size-4" />
                Novo Funil
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {funnels.map((funnel) => (
                <div
                  key={funnel.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-2 sm:px-3"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(funnel);
                      setBuilderOpen(true);
                    }}
                    className="min-w-0 flex-1 cursor-pointer rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50"
                  >
                    <p className="truncate font-medium text-foreground">{funnel.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {funnel.nodes.length} etapas · {funnel.edges.length} conexões · atualizado{" "}
                      {new Date(funnel.updatedAt).toLocaleString("pt-BR")}
                    </p>
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 cursor-pointer"
                    onClick={() => {
                      setEditing(funnel);
                      setBuilderOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 cursor-pointer gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setFunnelPendingDelete(funnel)}
                  >
                    <Trash2 className="size-3.5" />
                    Excluir
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FunnelBuilderModal
        open={builderOpen}
        onOpenChange={(next) => {
          setBuilderOpen(next);
          if (!next) setEditing(null);
        }}
        initialDraft={editing}
        onSaved={(saved) => {
          setEditing(saved);
          reload();
        }}
      />

      <AlertDialog
        open={Boolean(funnelPendingDelete)}
        onOpenChange={(open) => !open && setFunnelPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funil?</AlertDialogTitle>
            <AlertDialogDescription>
              {funnelPendingDelete
                ? `Excluir o funil "${funnelPendingDelete.name}"? Esta ação não pode ser desfeita.`
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                confirmDeleteFunnel();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function MarketingApiAlternativaPanel() {
  const listCampaigns = useServerFn(listSomaAlternativaCampaignsFn);
  const setActive = useServerFn(setSomaAlternativaCampaignActiveFn);
  const addInstances = useServerFn(addSomaAlternativaCampaignInstancesFn);
  const renameCampaign = useServerFn(renameSomaAlternativaCampaignFn);
  const deleteCampaign = useServerFn(deleteSomaAlternativaCampaignFn);

  const [items, setItems] = useState<SomaAlternativaCampaign[]>([]);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<SomaAlternativaCampaign | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SomaAlternativaCampaign | null>(null);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const result = await listCampaigns();
        if (!result.ok) {
          setError(result.error || "Não foi possível carregar as campanhas.");
          setItems([]);
          return;
        }
        setError(null);
        setOwnerEmail(result.ownerEmail || "");
        setItems(result.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar API Alternativa.");
        setItems([]);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [listCampaigns],
  );

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh({ silent: true });
    }, 20_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function withBusy(id: string, action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setBusyId(id);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error || "Ação não concluída no WABA.");
        return;
      }
      toast.success(result.message || "Ação enviada ao WABA.");
      await refresh({ silent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na ação.");
    } finally {
      setBusyId(null);
    }
  }

  function formatStart(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("pt-BR");
    } catch {
      return "—";
    }
  }

  return (
    <>
      <Card className="border-border/60 shadow-soft">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="font-display flex items-center gap-2 text-base">
              <Zap className="size-4 text-primary" />
              Campanhas · API Alternativa
            </CardTitle>
            <CardDescription>
              Mesmas ações do WABA (ativar, instâncias, renomear, excluir), executadas na conta
              {ownerEmail ? (
                <>
                  {" "}
                  <span className="text-foreground">{ownerEmail}</span>
                </>
              ) : null}{" "}
              via integração Soma → WABA.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            className="cursor-pointer gap-1.5"
            onClick={() => {
              void refresh().then(() => toast.success("Lista atualizada."));
            }}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
              {error}
            </div>
          ) : loading && items.length === 0 ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Carregando campanhas do WABA…
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
              <p className="font-medium text-foreground">Nenhuma campanha ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie pelo módulo <span className="font-medium text-foreground">Disparo</span> no Funil
                (Gerar Campanha). A campanha nasce pausada no WABA e aparece aqui.
              </p>
            </div>
          ) : (
            items.map((campaign) => {
              const status = String(campaign.status || "").toLowerCase();
              const isRunning = status === "running";
              const isFinished = status === "finished";
              const health = campaign.instanceHealth;
              const needsMore = health?.needsMoreInstancesForMinimum === true;
              const busy = busyId === campaign.id;
              const progress = Math.max(
                0,
                Math.min(100, Number(campaign.progressPercent) || 0),
              );
              const stage = campaign.runtimeStage;

              return (
                <div
                  key={campaign.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <h4 className="truncate font-semibold text-foreground">{campaign.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          Início: {formatStart(campaign.createdAt)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatCount(campaign.processedCount)} de{" "}
                          {formatCount(campaign.totalNumbers)} destinos processados ·{" "}
                          {formatCount(campaign.sentCount)} enviados
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(campaign.disparadorInstances || []).map((tag) => (
                          <span
                            key={tag.instanceName}
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-medium",
                              tag.connected
                                ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                                : "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
                            )}
                          >
                            {tag.instanceName}
                          </span>
                        ))}
                      </div>
                      {needsMore ? (
                        <p className="text-sm text-destructive">
                          Quantidade mínima para campanha = {health.minConnectedRequired} números
                        </p>
                      ) : null}
                      {health?.shouldPauseByDisconnectedRatio ? (
                        <p className="text-sm text-destructive">
                          50% ou mais das instâncias selecionadas estão desconectadas.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || isFinished || (needsMore && !isRunning)}
                        className={cn(
                          "cursor-pointer",
                          isRunning
                            ? "bg-amber-500 text-black hover:bg-amber-400"
                            : "bg-emerald-600 text-white hover:bg-emerald-500",
                        )}
                        onClick={() =>
                          void withBusy(campaign.id, () =>
                            setActive({ data: { id: campaign.id, ativa: !isRunning } }),
                          )
                        }
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : isFinished ? (
                          "Campanha finalizada"
                        ) : isRunning ? (
                          "Pausar"
                        ) : (
                          "Ativar campanha"
                        )}
                      </Button>
                      {needsMore ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          className="cursor-pointer"
                          onClick={() =>
                            void withBusy(campaign.id, () =>
                              addInstances({ data: { id: campaign.id } }),
                            )
                          }
                        >
                          + Instâncias
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        className="cursor-pointer gap-1"
                        onClick={() => {
                          setRenameTarget(campaign);
                          setRenameValue(campaign.name);
                        }}
                      >
                        <Pencil className="size-3.5" />
                        Editar nome
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        className="cursor-pointer gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(campaign)}
                      >
                        <Trash2 className="size-3.5" />
                        Excluir
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          isRunning ? "bg-emerald-500" : "bg-amber-400",
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {stage?.label || (isRunning ? "Enviando" : "Pausada")}
                      </span>
                      {stage?.detail ? ` · ${stage.detail}` : null}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar nome da campanha</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="soma-campaign-rename">Nome</Label>
            <Input
              id="soma-campaign-rename"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!renameValue.trim() || !renameTarget}
              onClick={() => {
                if (!renameTarget) return;
                const id = renameTarget.id;
                const name = renameValue.trim();
                setRenameTarget(null);
                void withBusy(id, () => renameCampaign({ data: { id, name } }));
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Excluir "${deleteTarget.name}" no WABA? Esta ação não pode ser desfeita.`
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (!deleteTarget) return;
                const id = deleteTarget.id;
                setDeleteTarget(null);
                void withBusy(id, () => deleteCampaign({ data: { id } }));
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
