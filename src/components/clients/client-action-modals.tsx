import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Loader2, Paperclip } from "lucide-react";
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
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Label } from "@/components/ui/label";
import { ClientAttachmentsPanel } from "@/components/clients/client-attachments-panel";
import { getClientScheduleFn, saveClientScheduleFn } from "@/lib/clients/clients.server";
import type { ClientActivityFlags, ClientListItem } from "@/lib/clients/client.types";
import { localDateString } from "@/lib/dates/local-date";

export type ClientActionKind = "schedule" | "attendance" | "attachments";

type Props = {
  client: ClientListItem | null;
  action: ClientActionKind | null;
  onClose: () => void;
  onActivityChange?: (clientId: string, flags: Partial<ClientActivityFlags>) => void;
};

function clientLabel(client: ClientListItem) {
  return client.nome ?? client.cpf ?? client.telefone ?? client.id;
}

function defaultContactDate(): string {
  const today = localDateString();
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(year!, month! - 1, day! + 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ClientActionModals({ client, action, onClose, onActivityChange }: Props) {
  const getSchedule = useServerFn(getClientScheduleFn);
  const saveSchedule = useServerFn(saveClientScheduleFn);
  const getScheduleRef = useRef(getSchedule);
  const saveScheduleRef = useRef(saveSchedule);
  getScheduleRef.current = getSchedule;
  saveScheduleRef.current = saveSchedule;

  const [contactDate, setContactDate] = useState(defaultContactDate);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    if (action !== "schedule" || !client?.id) return;

    let cancelled = false;
    setLoadingSchedule(true);
    setContactDate(defaultContactDate());

    void getScheduleRef
      .current({ data: { clientId: client.id } })
      .then((schedule) => {
        if (cancelled) return;
        if (schedule?.contactDate) setContactDate(schedule.contactDate);
      })
      .catch(() => {
        if (!cancelled) setContactDate(defaultContactDate());
      })
      .finally(() => {
        if (!cancelled) setLoadingSchedule(false);
      });

    return () => {
      cancelled = true;
    };
  }, [action, client?.id]);

  const open = Boolean(client && action);

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  if (!client || !action) return null;

  const label = clientLabel(client);

  if (action === "schedule") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Calendar className="size-5 text-primary" />
              Agendar contato
            </DialogTitle>
            <DialogDescription>
              Defina o próximo dia em que o vendedor fará contato com{" "}
              <span className="font-medium text-foreground">{label}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="client-contact-date">Data do próximo contato</Label>
            <DatePickerField
              id="client-contact-date"
              value={contactDate}
              onChange={setContactDate}
              placeholder="Selecionar data"
              disabled={loadingSchedule}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={savingSchedule || loadingSchedule}
              onClick={() => {
                if (!client) return;
                setSavingSchedule(true);
                void saveScheduleRef
                  .current({ data: { clientId: client.id, contactDate } })
                  .then(() => {
                    onActivityChange?.(client.id, { hasSchedule: true });
                    toast.success(`Contato agendado para ${contactDate.split("-").reverse().join("/")}`);
                    onClose();
                  })
                  .catch((error) => {
                    toast.error(error instanceof Error ? error.message : "Não foi possível agendar o contato.");
                  })
                  .finally(() => setSavingSchedule(false));
              }}
            >
              {savingSchedule ? <Loader2 className="size-4 animate-spin" /> : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (action === "attendance") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(90vh,760px)] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Paperclip className="size-5 text-primary" />
            Arquivos do cliente
          </DialogTitle>
          <DialogDescription>
            Anexe documentos e arquivos para{" "}
            <span className="font-medium text-foreground">{label}</span>.
          </DialogDescription>
        </DialogHeader>
        <ClientAttachmentsPanel
          clientId={client.id}
          enabled={open}
          onAttachmentsChange={(hasAttachments) =>
            onActivityChange?.(client.id, { hasAttachments })
          }
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
