import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { IdCard, Link2, Loader2, NotebookPen, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { ClientAttendanceDialog } from "@/components/clients/client-attendance-dialog";
import { ClientFieldInput } from "@/components/clients/client-field-input";
import { StatusBadge } from "@/components/clients/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChatConversation } from "@/lib/chat/chat.types";
import {
  addChatClientProductFn,
  createAndLinkChatClientFn,
  saveChatContactNoteFn,
  setChatClientStatusFn,
} from "@/lib/chat/chat.server";
import { CHAT_CONTACT_NOTE_MAX_LENGTH } from "@/lib/chat/chat-contact-note.constants";
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

function ContactNoteEditor({
  conversation,
  onUpdated,
}: {
  conversation: ChatConversation;
  onUpdated: (next: ChatConversation) => void;
}) {
  const saveContactNote = useServerFn(saveChatContactNoteFn);
  const [note, setNote] = useState(conversation.contactNote ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNote(conversation.contactNote ?? "");
  }, [conversation.id, conversation.contactNote]);

  const savedNote = (conversation.contactNote ?? "").trim();
  const normalizedNote = note.trim();
  const changed = normalizedNote !== savedNote;

  async function handleSave() {
    if (!changed || saving) return;
    setSaving(true);
    try {
      const next = await saveContactNote({
        data: { conversationId: conversation.id, note },
      });
      onUpdated(next);
      toast.success(normalizedNote ? "Observação salva" : "Observação removida");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar observação");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center gap-1.5">
        <NotebookPen className="size-3.5 text-primary" aria-hidden="true" />
        <Label htmlFor={`chat-contact-note-${conversation.id}`} className="text-xs font-medium">
          Observação do contato
        </Label>
      </div>
      <Textarea
        id={`chat-contact-note-${conversation.id}`}
        value={note}
        maxLength={CHAT_CONTACT_NOTE_MAX_LENGTH}
        placeholder="Ex.: prefere contato após as 14h…"
        className="min-h-20 resize-y text-xs leading-relaxed"
        onChange={(event) => setNote(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            void handleSave();
          }
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          {note.length}/{CHAT_CONTACT_NOTE_MAX_LENGTH}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 cursor-pointer px-2.5 text-xs"
          disabled={!changed || saving}
          onClick={() => void handleSave()}
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-3.5" aria-hidden="true" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
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
  const addClientProduct = useServerFn(addChatClientProductFn);

  const [productId, setProductId] = useState("");
  const [fields, setFields] = useState<Partial<Record<ClientFieldId, string>>>({});
  const [statusId, setStatusId] = useState(
    () => attendanceStatuses.find((s) => s.id === "em_atendimento")?.id ?? attendanceStatuses[0]?.id ?? "novo",
  );
  const [saving, setSaving] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [additionalProductId, setAdditionalProductId] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);

  const product = useMemo(
    () => products.find((item) => item.id === productId) ?? null,
    [products, productId],
  );

  const requiredFields = useMemo(
    () => (product ? productFieldsForImport(product).required : []),
    [product],
  );

  const linkedProducts = useMemo(
    () =>
      products.filter((item) => (conversation.clientProductIds ?? []).includes(item.id)),
    [conversation.clientProductIds, products],
  );
  const availableProducts = useMemo(
    () =>
      products.filter((item) => !(conversation.clientProductIds ?? []).includes(item.id)),
    [conversation.clientProductIds, products],
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
        <ContactNoteEditor conversation={conversation} onUpdated={onUpdated} />
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Produtos do cliente</Label>
          {linkedProducts.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {linkedProducts.map((item) => (
                <StatusBadge key={item.id} label={item.name} color={item.color} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Produto principal não identificado.</p>
          )}

          {availableProducts.length > 0 ? (
            <div className="flex items-center gap-2">
              <Select
                value={additionalProductId || undefined}
                onValueChange={setAdditionalProductId}
              >
                <SelectTrigger className="h-8 min-w-0 flex-1 cursor-pointer">
                  <SelectValue placeholder="Adicionar produto" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((item) => (
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
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shrink-0 cursor-pointer"
                aria-label="Adicionar produto ao cliente"
                disabled={!additionalProductId || addingProduct}
                onClick={() => {
                  void (async () => {
                    if (!additionalProductId) return;
                    setAddingProduct(true);
                    try {
                      const next = await addClientProduct({
                        data: {
                          conversationId: conversation.id,
                          productId: additionalProductId,
                        },
                      });
                      if (next) onUpdated(next);
                      setAdditionalProductId("");
                      toast.success("Produto adicionado ao cliente");
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Falha ao adicionar produto",
                      );
                    } finally {
                      setAddingProduct(false);
                    }
                  })();
                }}
              >
                {addingProduct ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Todos os produtos já estão vinculados.</p>
          )}
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
      <ContactNoteEditor conversation={conversation} onUpdated={onUpdated} />

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
