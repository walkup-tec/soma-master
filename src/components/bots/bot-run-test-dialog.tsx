import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Play } from "lucide-react";
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
import { continueBotTestRunFn, startBotTestRunFn } from "@/lib/bots/bots.server";
import type { BotFlowDraft, BotRunState } from "@/lib/bots/bot.types";

export function BotRunTestDialog({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: BotFlowDraft;
}) {
  const startRun = useServerFn(startBotTestRunFn);
  const continueRun = useServerFn(continueBotTestRunFn);
  const [phone, setPhone] = useState("");
  const [inbound, setInbound] = useState("");
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<BotRunState | null>(null);

  async function handleStart() {
    setBusy(true);
    try {
      const result = (await startRun({
        data: { flow: draft, testPhone: phone },
      })) as {
        ok: boolean;
        error?: string;
        run?: BotRunState;
        message?: string;
      };
      if (!result.ok || !result.run) {
        toast.error(result.error || "Falha ao iniciar execução");
        return;
      }
      setRun(result.run);
      toast.success(result.message || "Execução iniciada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao iniciar teste");
    } finally {
      setBusy(false);
    }
  }

  async function handleContinue() {
    if (!run) return;
    setBusy(true);
    try {
      const result = (await continueRun({
        data: {
          flow: draft,
          runId: run.id,
          inboundText: inbound.trim() || undefined,
        },
      })) as {
        ok: boolean;
        error?: string;
        run?: BotRunState;
      };
      if (!result.ok || !result.run) {
        toast.error(result.error || "Falha ao continuar");
        return;
      }
      setRun(result.run);
      setInbound("");
      toast.success(`Fase: ${result.run.phase}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao continuar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setRun(null);
          setInbound("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Execução de fluxo</DialogTitle>
          <DialogDescription>
            Informe o WhatsApp de teste. O bot inicia a interação a partir do node Início e
            alterna Chatbot, IA e Sistema de forma contínua.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bot-test-phone">Número de teste</Label>
            <Input
              id="bot-test-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="5511999999999"
              disabled={Boolean(run)}
            />
          </div>

          {run ? (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <p>
                Fase: <span className="font-medium">{run.phase}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Node atual: {run.currentNodeId || "—"} · {run.testPhone}
              </p>
              {run.phase === "waiting_reply" ? (
                <div className="space-y-1.5">
                  <Label>Simular resposta do contato</Label>
                  <Textarea
                    rows={3}
                    value={inbound}
                    onChange={(event) => setInbound(event.target.value)}
                    placeholder="Texto que o número responderia…"
                  />
                </div>
              ) : null}
              <div className="max-h-40 overflow-auto rounded-md border border-border/50 bg-background p-2 text-xs">
                {run.logs
                  .slice()
                  .reverse()
                  .slice(0, 12)
                  .map((entry, index) => (
                    <p key={`${entry.at}-${index}`} className="mb-1">
                      [{entry.level}] {entry.message}
                    </p>
                  ))}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!run ? (
            <Button
              type="button"
              className="cursor-pointer gap-1.5"
              disabled={busy || !phone.trim()}
              onClick={() => void handleStart()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Iniciar execução
            </Button>
          ) : (
            <Button
              type="button"
              className="cursor-pointer gap-1.5"
              disabled={busy || run.phase === "finished" || run.phase === "error"}
              onClick={() => void handleContinue()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Continuar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
