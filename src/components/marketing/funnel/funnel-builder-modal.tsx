import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FunnelBuilderCanvas } from "@/components/marketing/funnel/funnel-builder-canvas";
import {
  createDefaultFunnelDraft,
  ensureFunnelHasStart,
  normalizeFunnelDraft,
  type FunnelDraft,
} from "@/lib/marketing/funnel.types";
import { useSystemSettings } from "@/hooks/use-system-settings";

const STORAGE_KEY = "soma-marketing-funnels-v1";

function readStoredFunnels(): FunnelDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FunnelDraft[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ensureFunnelHasStart(normalizeFunnelDraft(item)));
  } catch {
    return [];
  }
}

function writeStoredFunnels(items: FunnelDraft[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(items.map((item) => ensureFunnelHasStart(normalizeFunnelDraft(item)))),
  );
}

export function listStoredFunnels(): FunnelDraft[] {
  return readStoredFunnels().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getStoredFunnelById(id: string): FunnelDraft | null {
  const found = readStoredFunnels().find((item) => item.id === id);
  return found ? ensureFunnelHasStart(normalizeFunnelDraft(found)) : null;
}

export function deleteStoredFunnel(id: string): boolean {
  const current = readStoredFunnels();
  const next = current.filter((item) => item.id !== id);
  if (next.length === current.length) return false;
  writeStoredFunnels(next);
  return true;
}

/**
 * Modal 100% viewport — funil de prospecção (não robô de atendimento).
 */
export function FunnelBuilderModal({
  open,
  onOpenChange,
  initialDraft,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDraft?: FunnelDraft | null;
  onSaved?: (draft: FunnelDraft) => void;
}) {
  const { settings } = useSystemSettings();
  const [draft, setDraft] = useState<FunnelDraft>(() => createDefaultFunnelDraft());
  const [canvasKey, setCanvasKey] = useState(0);
  const wasOpenRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Carrega o rascunho só na abertura (evita reset no meio da edição)
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;

    let next: FunnelDraft;
    if (initialDraft?.id) {
      next =
        getStoredFunnelById(initialDraft.id) ??
        ensureFunnelHasStart(normalizeFunnelDraft(structuredClone(initialDraft)));
    } else {
      next = ensureFunnelHasStart(createDefaultFunnelDraft());
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
    const name = current.name.trim() || "Novo funil";
    const next = ensureFunnelHasStart(
      normalizeFunnelDraft({
        ...current,
        name,
        updatedAt: new Date().toISOString(),
      }),
    );
    if (next.nodes.length === 0) {
      toast.error("O funil está vazio — adicione etapas antes de salvar.");
      return;
    }
    const others = readStoredFunnels().filter((item) => item.id !== next.id);
    writeStoredFunnels([next, ...others]);
    setDraft(next);
    onSaved?.(next);
    toast.success(`Funil salvo · ${next.nodes.length} etapa(s)`);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] w-[100vw] flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Construtor de funil de prospecção"
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Funil de prospecção
          </p>
          <Input
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            className="mt-0.5 h-8 max-w-md border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
            placeholder="Nome do funil"
          />
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {draft.nodes.length} etapa(s) · {draft.edges.length} conexão(ões)
        </p>
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
        <FunnelBuilderCanvas
          key={`${draft.id}-${canvasKey}`}
          draft={draft}
          onChange={setDraft}
          products={settings.products}
          attendanceStatuses={settings.attendanceStatuses}
        />
      </div>
    </div>,
    document.body,
  );
}
