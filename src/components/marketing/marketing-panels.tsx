import { useCallback, useEffect, useState } from "react";
import { Filter, Plus, Trash2 } from "lucide-react";
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
  FunnelBuilderModal,
  deleteStoredFunnel,
  listStoredFunnels,
} from "@/components/marketing/funnel/funnel-builder-modal";
import type { FunnelDraft } from "@/lib/marketing/funnel.types";

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
