import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FunnelBuilderCanvas } from "@/components/marketing/funnel/funnel-builder-canvas";
import {
  createDefaultFunnelDraft,
  type FunnelDraft,
} from "@/lib/marketing/funnel.types";

const STORAGE_KEY = "soma-marketing-funnels-v1";

function readStoredFunnels(): FunnelDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FunnelDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredFunnels(items: FunnelDraft[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function listStoredFunnels(): FunnelDraft[] {
  return readStoredFunnels().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Modal em tela cheia (100% viewport) para construir o funil.
 * Primeira versão: arrastar etapas + conectar (estilo Typebot / BotConversa).
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
  const [draft, setDraft] = useState<FunnelDraft>(() => createDefaultFunnelDraft());

  useEffect(() => {
    if (!open) return;
    setDraft(initialDraft ? structuredClone(initialDraft) : createDefaultFunnelDraft());
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
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function handleSave() {
    const name = draft.name.trim() || "Novo funil";
    const next: FunnelDraft = {
      ...draft,
      name,
      updatedAt: new Date().toISOString(),
    };
    const current = readStoredFunnels().filter((item) => item.id !== next.id);
    writeStoredFunnels([next, ...current]);
    setDraft(next);
    onSaved?.(next);
    toast.success("Funil salvo (rascunho local)");
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] w-[100vw] flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Construtor de funil"
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Construtor de funil
          </p>
          <Input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            className="mt-0.5 h-8 max-w-md border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
            placeholder="Nome do funil"
          />
        </div>
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
        <FunnelBuilderCanvas key={draft.id} draft={draft} onChange={setDraft} />
      </div>
    </div>,
    document.body,
  );
}
