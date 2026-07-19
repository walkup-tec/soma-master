import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FunnelStepEditor } from "@/components/marketing/funnel/funnel-step-editor";
import type { FunnelStepData } from "@/lib/marketing/funnel.types";
import type { AttendanceStatusConfig, ProductConfig } from "@/lib/config/settings-types";

const KIND_HINT: Record<FunnelStepData["kind"], string> = {
  start: "Defina se o funil começa na hora ou em data/hora agendada.",
  pause: "Quanto tempo aguardar antes da próxima etapa.",
  audience: "Quem entra neste ponto do funil (filtros, tags ou importação).",
  disparo: "Campanha WhatsApp via API Alternativa no WABA.",
  feedback: "Ramificações por clique no link e chat.",
  email_mkt: "Assunto e corpo do e-mail com variáveis do contato.",
  end: "Encerra o funil neste ramo.",
};

export function FunnelStepConfigModal({
  open,
  onOpenChange,
  data,
  onChange,
  onDelete,
  canDelete,
  products,
  attendanceStatuses,
  upstreamAudienceCount = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FunnelStepData;
  onChange: (next: FunnelStepData) => void;
  onDelete: () => void;
  canDelete: boolean;
  products: ProductConfig[];
  attendanceStatuses: AttendanceStatusConfig[];
  upstreamAudienceCount?: number | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex z-[150] max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        overlayClassName="z-[150]"
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-radix-popper-content-wrapper], [data-slot=popover-content]")) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-radix-popper-content-wrapper], [data-slot=popover-content]")) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="size-5 text-muted-foreground" />
            Configurar · {data.label}
          </DialogTitle>
          <DialogDescription>{KIND_HINT[data.kind]}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <FunnelStepEditor
            data={data}
            onChange={onChange}
            onDelete={() => {
              onDelete();
              onOpenChange(false);
            }}
            canDelete={canDelete}
            products={products}
            attendanceStatuses={attendanceStatuses}
            upstreamAudienceCount={upstreamAudienceCount}
            comfortable
          />
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-4 sm:justify-end">
          <Button type="button" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
