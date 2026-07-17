import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { attendanceStatuses } from "@/lib/clients/client-status";
import {
  createClientAttendanceFn,
  deleteClientAttendanceFn,
  getClientDetailFn,
  listClientAttendancesFn,
  updateClientStatusFn,
} from "@/lib/clients/clients.server";
import type {
  ClientActivityFlags,
  ClientAttendanceRecord,
  ClientRecord,
} from "@/lib/clients/client.types";
import { ClientAttachmentsPanel } from "@/components/clients/client-attachments-panel";
import { CLIENT_FIELD_GROUPS, clientFieldLabel, type ClientFieldId } from "@/lib/config/client-fields";

type Props = {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivityChange?: (clientId: string, flags: Partial<ClientActivityFlags>) => void;
  onStatusChange?: (clientId: string, status: string) => void;
};

/** Contatos mapeados na importação — ficam na coluna Contato (não nos dados indexados). */
const CONTACT_FIELD_IDS: ClientFieldId[] = ["email", "telefone", "whatsapp"];
const CONTACT_FIELD_SET = new Set<ClientFieldId>(CONTACT_FIELD_IDS);
const WHATSAPP_NOTE_PREFIX = /^\[WhatsApp\]\s*/i;

function WhatsAppSourceIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-label="Origem WhatsApp"
      role="img"
      className="mt-0.5 size-4 shrink-0 fill-[#25D366]"
    >
      <path d="M16.04 3A12.86 12.86 0 0 0 5 22.48L3.22 29l6.68-1.75A12.94 12.94 0 1 0 16.04 3Zm0 23.65c-2.02 0-4-.55-5.72-1.58l-.41-.25-3.96 1.04 1.06-3.86-.27-.42a10.61 10.61 0 1 1 9.3 5.07Zm5.82-7.94c-.32-.16-1.88-.93-2.17-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.19.21-.37.24-.69.08-.32-.16-1.34-.49-2.55-1.57a9.54 9.54 0 0 1-1.77-2.2c-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.18.21-.32.32-.53.1-.21.05-.4-.03-.56-.08-.16-.71-1.72-.98-2.35-.26-.62-.52-.54-.71-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.65 0 1.56 1.14 3.07 1.3 3.28.16.21 2.24 3.42 5.43 4.8.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.88-.77 2.14-1.51.27-.74.27-1.38.19-1.51-.08-.13-.29-.21-.61-.37Z" />
    </svg>
  );
}

async function copyText(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

function formatAttendanceDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function clientTitle(client: ClientRecord): string {
  return client.data.nome ?? client.data.cpf ?? client.data.telefone ?? client.id;
}

function indexedFieldGroups(client: ClientRecord) {
  return CLIENT_FIELD_GROUPS.map((group) => ({
    ...group,
    fields: group.fields.filter((field) => {
      if (CONTACT_FIELD_SET.has(field.id)) return false;
      const value = client.data[field.id]?.trim();
      return Boolean(value);
    }),
  })).filter((group) => group.fields.length > 0);
}

function mappedContacts(client: ClientRecord) {
  return CONTACT_FIELD_IDS.flatMap((fieldId) => {
    const value = client.data[fieldId]?.trim();
    if (!value) return [];
    return [{ fieldId, label: clientFieldLabel(fieldId), value }];
  });
}

export function ClientAttendanceDialog({
  clientId,
  open,
  onOpenChange,
  onActivityChange,
  onStatusChange,
}: Props) {
  const { settings } = useSystemSettings();
  const getClientDetail = useServerFn(getClientDetailFn);
  const listAttendances = useServerFn(listClientAttendancesFn);
  const createAttendance = useServerFn(createClientAttendanceFn);
  const deleteAttendance = useServerFn(deleteClientAttendanceFn);
  const updateStatus = useServerFn(updateClientStatusFn);

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [attendances, setAttendances] = useState<ClientAttendanceRecord[]>([]);
  const [note, setNote] = useState("");
  const [statusValue, setStatusValue] = useState("novo");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const getClientDetailRef = useRef(getClientDetail);
  const listAttendancesRef = useRef(listAttendances);
  const onOpenChangeRef = useRef(onOpenChange);
  getClientDetailRef.current = getClientDetail;
  listAttendancesRef.current = listAttendances;
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (open) return;
    setClient(null);
    setAttendances([]);
    setNote("");
    setStatusValue("novo");
    setLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open || !clientId) return;

    let cancelled = false;
    setLoading(true);

    void Promise.all([
      getClientDetailRef.current({ data: { clientId } }),
      listAttendancesRef.current({ data: { clientId } }),
    ])
      .then(([detail, history]) => {
        if (cancelled) return;
        setClient(detail);
        setStatusValue(detail.status);
        setAttendances(history);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error instanceof Error ? error.message : "Não foi possível carregar o cliente.");
        onOpenChangeRef.current(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, clientId]);

  const groups = useMemo(() => (client ? indexedFieldGroups(client) : []), [client]);
  const contacts = useMemo(() => (client ? mappedContacts(client) : []), [client]);

  const statusOptions = useMemo(() => attendanceStatuses(settings), [settings]);

  const handleCopyContact = (label: string, value: string) => {
    void copyText(value, `${label} copiado.`);
  };

  const handleCopyAllContacts = () => {
    if (contacts.length === 0) return;
    const payload = contacts.map((item) => `${item.label}: ${item.value}`).join("\n");
    void copyText(payload, "Dados de contato copiados.");
  };

  const handleStatusChange = async (nextStatus: string) => {
    if (!clientId || nextStatus === statusValue) return;

    setSavingStatus(true);
    try {
      const result = await updateStatus({ data: { clientId, status: nextStatus } });
      setStatusValue(result.client.status);
      setClient((current) => (current ? { ...current, status: result.client.status } : current));
      setAttendances((current) => [result.attendance, ...current]);
      onStatusChange?.(clientId, result.client.status);
      onActivityChange?.(clientId, {
        hasAttendance: true,
        ...(result.scheduleContactDate ? { hasSchedule: true } : {}),
      });
      if (result.scheduleContactDate) {
        const [, month, day] = result.scheduleContactDate.split("-");
        toast.success(
          `Status atualizado. Retorno automático na Agenda em ${day}/${month}.`,
        );
      } else {
        toast.success("Status atualizado e registrado no histórico.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o status.");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSubmit = async () => {
    if (!clientId || !note.trim()) {
      toast.error("Descreva o atendimento antes de registrar.");
      return;
    }

    setSaving(true);
    try {
      const created = await createAttendance({ data: { clientId, note: note.trim() } });
      setAttendances((current) => [created, ...current]);
      if (clientId) onActivityChange?.(clientId, { hasAttendance: true });
      setNote("");
      toast.success("Atendimento registrado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o atendimento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,900px)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <MessageSquare className="size-5 text-primary" />
            Registrar atendimento
          </DialogTitle>
          <DialogDescription>
            {client ? (
              <>
                Cliente: <span className="font-medium text-foreground">{clientTitle(client)}</span>
              </>
            ) : (
              "Carregando dados do cliente…"
            )}
          </DialogDescription>
        </DialogHeader>

        {loading && !client ? (
          <div className="flex min-h-[420px] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando informações…
          </div>
        ) : client ? (
          <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="min-h-0 min-w-0 border-b border-border/60 lg:border-b-0 lg:border-r">
              <div className="border-b border-border/60 px-5 py-3">
                <h3 className="text-sm font-semibold">Dados indexados na importação</h3>
                <p className="text-xs text-muted-foreground">
                  Campos preenchidos na planilha para este cliente.
                </p>
              </div>
              <ScrollArea className="h-[min(58vh,620px)]">
                <div className="space-y-5 p-5">
                  {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum dado indexado além dos contatos.
                    </p>
                  ) : (
                    groups.map((group) => (
                      <div key={group.id} className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.title}
                        </h4>
                        <dl className="grid gap-2 sm:grid-cols-2">
                          {group.fields.map((field) => (
                            <div
                              key={field.id}
                              className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                            >
                              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                {clientFieldLabel(field.id)}
                              </dt>
                              <dd className="mt-1 text-sm font-medium break-words">
                                {client.data[field.id]}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))
                  )}

                  {clientId ? (
                    <>
                      <Separator />
                      <ClientAttachmentsPanel
                        clientId={clientId}
                        enabled={open}
                        onAttachmentsChange={(hasAttachments) =>
                          onActivityChange?.(clientId, { hasAttachments })
                        }
                      />
                    </>
                  ) : null}
                </div>
              </ScrollArea>
            </section>

            <section className="flex min-h-0 min-w-0 flex-col">
              <ScrollArea className="h-[min(58vh,620px)]">
                <div className="min-w-0 space-y-5 p-5">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Contato</h3>
                      {contacts.length > 1 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={handleCopyAllContacts}
                        >
                          <Copy className="size-3.5" />
                          Copiar todos
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid min-w-0 grid-cols-1 gap-2">
                      {contacts.length > 0 ? (
                        contacts.map((item) => (
                          <div
                            key={item.fieldId}
                            className="min-w-0 overflow-hidden rounded-lg border border-border/60 bg-muted/20 px-3 py-3"
                          >
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {item.label}
                            </p>
                            <p className="mt-1 break-all text-sm font-medium">{item.value}</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-2 h-8"
                              onClick={() => handleCopyContact(item.label, item.value)}
                            >
                              <Copy className="size-3.5" />
                              Copiar
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          E-mail, telefone e WhatsApp não foram mapeados na importação.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="attendance-status">Status de atendimento</Label>
                    <Select
                      value={statusValue}
                      onValueChange={(value) => void handleStatusChange(value)}
                      disabled={savingStatus || !clientId}
                    >
                      <SelectTrigger id="attendance-status" className="w-full">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label htmlFor="attendance-note">Registrar atendimento</Label>
                    <Textarea
                      id="attendance-note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Descreva o que foi tratado com o cliente…"
                      rows={4}
                      className="min-h-28 resize-none"
                    />
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      disabled={saving || !note.trim()}
                      onClick={() => void handleSubmit()}
                    >
                      {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      Registrar atendimento
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Histórico</h3>
                      <span className="text-xs text-muted-foreground">
                        {attendances.length} registro(s)
                      </span>
                    </div>
                    {attendances.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
                        Nenhum atendimento registrado ainda.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {attendances.map((attendance) => (
                          <article
                            key={attendance.id}
                            className="rounded-lg border border-border/60 bg-background px-3 py-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <time className="font-medium text-foreground">
                                  {formatAttendanceDate(attendance.createdAt)}
                                </time>
                                <span>·</span>
                                <span>Registrado por {attendance.userName}</span>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-destructive hover:text-destructive"
                                title="Excluir atendimento"
                                onClick={() => {
                                  void (async () => {
                                    try {
                                      await deleteAttendance({
                                        data: { attendanceId: attendance.id },
                                      });
                                      setAttendances((current) =>
                                        current.filter((item) => item.id !== attendance.id),
                                      );
                                      toast.success("Atendimento excluído.");
                                    } catch (error) {
                                      toast.error(
                                        error instanceof Error
                                          ? error.message
                                          : "Não foi possível excluir o atendimento.",
                                      );
                                    }
                                  })();
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                            <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed">
                              {WHATSAPP_NOTE_PREFIX.test(attendance.note) ? (
                                <WhatsAppSourceIcon />
                              ) : null}
                              <span className="whitespace-pre-wrap">
                                {attendance.note.replace(WHATSAPP_NOTE_PREFIX, "")}
                              </span>
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
