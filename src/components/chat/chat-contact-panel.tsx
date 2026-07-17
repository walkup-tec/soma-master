import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { IdCard, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ClientAttendanceDialog } from "@/components/clients/client-attendance-dialog";
import { ClientFieldInput } from "@/components/clients/client-field-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChatConversation } from "@/lib/chat/chat.types";
import { createAndLinkChatClientFn, setChatClientStatusFn } from "@/lib/chat/chat.server";
import type { ClientFieldId } from "@/lib/config/client-fields";
import { productFieldsForImport } from "@/lib/clients/product-fields";
import type { AttendanceStatusConfig, BankConfig, ProductConfig } from "@/lib/config/settings-types";

type Props = {
  conversation: ChatConversation;
  attendanceStatuses: AttendanceStatusConfig[];
  products: ProductConfig[];
  banks: BankConfig[];
  onUpdated: (next: ChatConversation) => void;
  /** Nome/WhatsApp digitados no formulário — o cabeçalho Contato espelha em tempo real. */
  onDraftChange?: (draft: { name: string; phone: string }) => void;
};

function seedFieldsFromConversation(
  conversation: ChatConversation,
  requiredIds: ClientFieldId[],
): Partial<Record<ClientFieldId, string>> {
  const seed: Partial<Record<ClientFieldId, string>> = {};
  const name = (conversation.clientName || conversation.contactName || "").trim();
  const phone = conversation.phone.replace(/\D/g, "");
  if (requiredIds.includes("nome") && name) seed.nome = name;
  if (requiredIds.includes("telefone") && phone) seed.telefone = phone;
  if (requiredIds.includes("whatsapp") && phone) seed.whatsapp = phone;
  return seed;
}

export function ChatContactPanel({
  conversation,
  attendanceStatuses,
  products,
  banks,
  onUpdated,
  onDraftChange,
}: Props) {
  const createAndLink = useServerFn(createAndLinkChatClientFn);
  const setStatus = useServerFn(setChatClientStatusFn);

  const [productId, setProductId] = useState("");
  const [fields, setFields] = useState<Partial<Record<ClientFieldId, string>>>({});
  const [statusId, setStatusId] = useState(
    () => attendanceStatuses.find((s) => s.id === "em_atendimento")?.id ?? attendanceStatuses[0]?.id ?? "novo",
  );
  const [saving, setSaving] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const product = useMemo(
    () => products.find((item) => item.id === productId) ?? null,
    [products, productId],
  );

  const requiredFields = useMemo(
    () => (product ? productFieldsForImport(product).required : []),
    [product],
  );

  useEffect(() => {
    if (!product) {
      setFields({});
      return;
    }
    setFields(seedFieldsFromConversation(conversation, product.requiredFieldIds));
  }, [product, conversation.id, conversation.phone, conversation.contactName, conversation.clientName]);

  // Espelha nome/WhatsApp digitados no cabeçalho Contato (tempo real)
  useEffect(() => {
    onDraftChange?.({
      name: String(fields.nome ?? "").trim(),
      phone: String(fields.whatsapp ?? fields.telefone ?? "").trim(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.nome, fields.whatsapp, fields.telefone]);

  async function handleLink() {
    if (!product) {
      toast.error("Selecione o produto.");
      return;
    }
    for (const field of requiredFields) {
      if (!String(fields[field.id] ?? "").trim()) {
        toast.error(`Preencha: ${field.label}`);
        return;
      }
    }
    if (!statusId) {
      toast.error("Selecione o status do atendimento.");
      return;
    }

    setSaving(true);
    try {
      const next = await createAndLink({
        data: {
          conversationId: conversation.id,
          productId: product.id,
          statusId,
          data: fields,
        },
      });
      if (next) onUpdated(next);
      toast.success("Contato vinculado ao CRM");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao vincular contato");
    } finally {
      setSaving(false);
    }
  }

  if (conversation.clientId) {
    return (
      <div className="space-y-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Atendente</p>
          <p className="font-medium">{conversation.assignedUserName ?? "Não atribuído"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">IA nesta conversa</p>
          <p className="font-medium">{conversation.aiEnabled ? "Ligada" : "Pausada"}</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Status do atendimento</Label>
          <Select
            value={conversation.clientStatusId ?? undefined}
            onValueChange={async (nextStatusId) => {
              try {
                const next = await setStatus({
                  data: { conversationId: conversation.id, statusId: nextStatusId },
                });
                if (next) onUpdated(next);
                toast.success("Status atualizado");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Falha no status");
              }
            }}
          >
            <SelectTrigger className="h-8 w-full cursor-pointer">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {attendanceStatuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="link"
            className="h-auto cursor-pointer px-0"
            onClick={() => setDetailsOpen(true)}
          >
            <IdCard className="size-3.5" /> Detalhes
          </Button>
        </div>

        {/* Mesmo modal da tela Clientes (dados + histórico + status + anexos) */}
        <ClientAttendanceDialog
          clientId={conversation.clientId}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          onStatusChange={() => onUpdated(conversation)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs text-muted-foreground">Atendente</p>
        <p className="font-medium">{conversation.assignedUserName ?? "Não atribuído"}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">IA nesta conversa</p>
        <p className="font-medium">{conversation.aiEnabled ? "Ligada" : "Pausada"}</p>
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Vincular ao CRM
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Escolha o produto, preencha os obrigatórios e o status do atendimento.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Produto</Label>
          <Select
            value={productId || undefined}
            onValueChange={(value) => setProductId(value)}
          >
            <SelectTrigger className="h-8 w-full cursor-pointer">
              <SelectValue placeholder="Selecione o produto" />
            </SelectTrigger>
            <SelectContent>
              {products.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                      aria-hidden
                    />
                    {item.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {product && requiredFields.length > 0 ? (
          <div className="space-y-3 border-t border-border/50 pt-3">
            <p className="text-[11px] font-medium text-muted-foreground">
              Campos obrigatórios — {product.name}
            </p>
            {requiredFields.map((field) => (
              <div key={field.id} className="space-y-1">
                <Label htmlFor={`chat-link-${field.id}`} className="text-xs">
                  {field.label}
                  <span className="text-destructive"> *</span>
                </Label>
                <ClientFieldInput
                  id={`chat-link-${field.id}`}
                  fieldId={field.id}
                  value={fields[field.id] ?? ""}
                  banks={banks}
                  required
                  onChange={(value) =>
                    setFields((prev) => ({
                      ...prev,
                      [field.id]: value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label className="text-xs">Status do atendimento</Label>
          <Select value={statusId || undefined} onValueChange={setStatusId}>
            <SelectTrigger className="h-8 w-full cursor-pointer">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {attendanceStatuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          size="sm"
          className="w-full cursor-pointer"
          disabled={saving || !productId}
          onClick={() => void handleLink()}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          Vincular contato
        </Button>
      </div>
    </div>
  );
}
