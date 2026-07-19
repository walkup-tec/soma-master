import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRightLeft, Loader2, Search } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  listChatTransferTargetsFn,
  transferChatConversationFn,
} from "@/lib/chat/chat.server";
import type { ChatConversation } from "@/lib/chat/chat.types";

type TransferTarget = {
  id: string;
  name: string;
  email: string;
};

/**
 * Transfere o atendimento para outro usuário com acesso ao Chat.
 * Colocado no header do thread — ação explícita, como Atribuir.
 */
export function ChatTransferDialog({
  open,
  onOpenChange,
  conversationId,
  contactLabel,
  onTransferred,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  contactLabel: string;
  onTransferred: (conversation: ChatConversation) => void;
}) {
  const listTargets = useServerFn(listChatTransferTargetsFn);
  const transferChat = useServerFn(transferChatConversationFn);
  const [targets, setTargets] = useState<TransferTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedId(null);
      return;
    }
    setLoading(true);
    void listTargets()
      .then((next) => setTargets(next))
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Falha ao listar usuários");
        setTargets([]);
      })
      .finally(() => setLoading(false));
  }, [open, listTargets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter(
      (user) =>
        user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q),
    );
  }, [targets, query]);

  async function handleConfirm() {
    if (!conversationId || !selectedId || transferring) return;
    setTransferring(true);
    try {
      const next = await transferChat({
        data: { conversationId, toUserId: selectedId },
      });
      if (!next || typeof next !== "object" || !("id" in next)) {
        throw new Error("Falha ao transferir conversa.");
      }
      const target = targets.find((user) => user.id === selectedId);
      toast.success(
        target
          ? `Transferido para ${target.name} — agora em Meus dele(a)`
          : "Conversa transferida",
      );
      onTransferred(next as ChatConversation);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao transferir");
    } finally {
      setTransferring(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-4" aria-hidden />
            Transferir atendimento
          </DialogTitle>
          <DialogDescription>
            Enviar <span className="font-medium text-foreground">{contactLabel}</span> para outro
            usuário. A conversa sai dos seus{" "}
            <span className="font-medium text-foreground">Meus</span> e entra nos{" "}
            <span className="font-medium text-foreground">Meus</span> do destinatário.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="h-9 pl-8"
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Carregando usuários…
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nenhum usuário com acesso ao Chat encontrado.
            </p>
          ) : (
            <ul className="divide-y divide-border p-1">
              {filtered.map((user) => {
                const selected = selectedId === user.id;
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(user.id)}
                      className={cn(
                        "flex w-full cursor-pointer flex-col items-start rounded-md px-3 py-2.5 text-left transition-colors",
                        selected
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-muted text-foreground",
                      )}
                    >
                      <span className="text-sm font-medium">{user.name}</span>
                      <span className="text-[11px] text-muted-foreground">{user.email}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
            disabled={transferring}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="cursor-pointer gap-1.5"
            disabled={!selectedId || transferring || !conversationId}
            onClick={() => void handleConfirm()}
          >
            {transferring ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArrowRightLeft className="size-3.5" />
            )}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
