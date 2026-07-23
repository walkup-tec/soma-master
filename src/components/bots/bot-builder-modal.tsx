import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BotBuilderCanvas } from "@/components/bots/bot-builder-canvas";
import { BotBuilderErrorBoundary } from "@/components/bots/bot-builder-error-boundary";
import { BotRunTestDialog } from "@/components/bots/bot-run-test-dialog";
import {
  createFreshBotDraft,
  getStoredBotFlowById,
  saveStoredBotFlow,
} from "@/lib/bots/bot-flow.storage";
import {
  ensureBotHasStart,
  normalizeBotDraft,
} from "@/lib/bots/bot-flow.normalize";
import type { BotFlowDraft } from "@/lib/bots/bot.types";
import { useSystemSettings } from "@/hooks/use-system-settings";

/**
 * Modal 100% viewport — construtor híbrido de bots (Chatbot + IA + Sistema).
 */
export function BotBuilderModal({
  open,
  onOpenChange,
  initialDraft,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDraft?: BotFlowDraft | null;
  onSaved?: (draft: BotFlowDraft) => void;
}) {
  const { settings } = useSystemSettings();
  const [draft, setDraft] = useState<BotFlowDraft>(() => ({
    id: "bot-draft-pending",
    name: "Novo bot",
    updatedAt: new Date(0).toISOString(),
    nodes: [],
    edges: [],
  }));
  const [canvasKey, setCanvasKey] = useState(0);
  const [runOpen, setRunOpen] = useState(false);
  const wasOpenRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;

    let next: BotFlowDraft;
    if (initialDraft?.id) {
      next =
        getStoredBotFlowById(initialDraft.id) ??
        ensureBotHasStart(normalizeBotDraft(structuredClone(initialDraft)));
    } else {
      next = createFreshBotDraft();
    }
    setDraft(next);
    setCanvasKey((value) => value + 1);
  }, [open, initialDraft]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function handleSave() {
    const current = draftRef.current;
    const name = current.name.trim() || "Novo bot";
    const next = saveStoredBotFlow({ ...current, name });
    setDraft(next);
    onSaved?.(next);
    toast.success(`Bot salvo · ${next.nodes.length} node(s)`);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] w-[100vw] flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Construtor de bots"
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Bots · fluxo híbrido
          </p>
          <Input
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            className="mt-0.5 h-8 max-w-md border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
            placeholder="Nome do bot"
          />
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {draft.nodes.length} node(s) · {draft.edges.length} conexão(ões)
        </p>
        <Button
          type="button"
          variant="secondary"
          className="cursor-pointer gap-1.5"
          onClick={() => setRunOpen(true)}
        >
          <Play className="size-4" />
          Execução de fluxo
        </Button>
        <Button type="button" variant="outline" className="cursor-pointer gap-1.5" onClick={handleSave}>
          <Save className="size-4" />
          Salvar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="cursor-pointer"
          onClick={() => onOpenChange(false)}
          aria-label="Fechar construtor"
        >
          <X className="size-5" />
        </Button>
      </header>

      <div className="min-h-0 flex-1">
        <BotBuilderErrorBoundary onClose={() => onOpenChange(false)}>
          <BotBuilderCanvas
            key={`${draft.id}-${canvasKey}`}
            draft={draft}
            onChange={setDraft}
            products={settings.products || []}
            attendanceStatuses={settings.attendanceStatuses || []}
          />
        </BotBuilderErrorBoundary>
      </div>

      <BotRunTestDialog open={runOpen} onOpenChange={setRunOpen} draft={draft} />
    </div>,
    document.body,
  );
}
