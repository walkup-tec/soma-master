import { useCallback, useEffect, useState } from "react";
import { Bot, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BotBuilderModal } from "@/components/bots/bot-builder-modal";
import {
  deleteStoredBotFlow,
  listStoredBotFlows,
} from "@/lib/bots/bot-flow.storage";
import type { BotFlowDraft } from "@/lib/bots/bot.types";

export function BotsPanel() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<BotFlowDraft | null>(null);
  const [flows, setFlows] = useState<BotFlowDraft[]>([]);
  const [pendingDelete, setPendingDelete] = useState<BotFlowDraft | null>(null);

  const reload = useCallback(() => {
    setFlows(listStoredBotFlows());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function confirmDelete() {
    const flow = pendingDelete;
    if (!flow) return;
    if (!deleteStoredBotFlow(flow.id)) {
      toast.error("Não foi possível excluir o bot.");
      setPendingDelete(null);
      return;
    }
    if (editing?.id === flow.id) {
      setEditing(null);
      setBuilderOpen(false);
    }
    setPendingDelete(null);
    reload();
    toast.success("Bot excluído");
  }

  return (
    <>
      <Card className="border-border/60 shadow-soft">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="font-display text-base">Fluxos de bots</CardTitle>
            <CardDescription>
              Construtor visual híbrido (Chatbot, IA OpenAI e Sistema). Monte o atendimento
              omnichannel em tela cheia e teste com um número WhatsApp.
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
            Novo bot
          </Button>
        </CardHeader>
        <CardContent>
          {flows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
              <Bot className="size-10 text-muted-foreground/50" aria-hidden />
              <div>
                <p className="font-medium text-foreground">Nenhum bot ainda</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Clique em <span className="font-medium text-foreground">Novo bot</span> para abrir
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
                Novo bot
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {flows.map((flow) => (
                <div
                  key={flow.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-2 sm:px-3"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(flow);
                      setBuilderOpen(true);
                    }}
                    className="min-w-0 flex-1 cursor-pointer rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50"
                  >
                    <p className="truncate font-medium text-foreground">{flow.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {flow.nodes.length} nodes · {flow.edges.length} conexões · atualizado{" "}
                      {new Date(flow.updatedAt).toLocaleString("pt-BR")}
                    </p>
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 cursor-pointer gap-1"
                    onClick={() => {
                      setEditing(flow);
                      setBuilderOpen(true);
                    }}
                  >
                    <Pencil className="size-3.5" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 cursor-pointer text-destructive"
                    onClick={() => setPendingDelete(flow)}
                    aria-label={`Excluir ${flow.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <BotBuilderModal
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        initialDraft={editing}
        onSaved={() => reload()}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir bot?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `Excluir o bot "${pendingDelete.name}"? Esta ação não pode ser desfeita.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
