import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Filter, Flame, Phone, Plus, RefreshCw, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  const reload = useCallback(() => {
    setFunnels(listStoredFunnels());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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
                    onClick={() => {
                      const ok = window.confirm(
                        `Excluir o funil "${funnel.name}"? Esta ação não pode ser desfeita.`,
                      );
                      if (!ok) return;
                      if (!deleteStoredFunnel(funnel.id)) {
                        toast.error("Não foi possível excluir o funil.");
                        return;
                      }
                      if (editing?.id === funnel.id) {
                        setEditing(null);
                        setBuilderOpen(false);
                      }
                      reload();
                      toast.success("Funil excluído");
                    }}
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
    </>
  );
}

export function MarketingApiAlternativaPanel() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="mb-2 flex items-center gap-2 text-primary">
        <Zap className="size-4" />
        <h3 className="font-display text-lg font-semibold tracking-tight">API Alternativa</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Parâmetros e operação da API Alternativa para envio de mensagens.
      </p>
    </div>
  );
}
