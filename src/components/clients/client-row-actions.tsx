import { Calendar, MessageSquare, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ClientActionKind } from "@/components/clients/client-action-modals";
import type { ClientListItem } from "@/lib/clients/client.types";

type Props = {
  client: ClientListItem;
  onAction: (client: ClientListItem, action: ClientActionKind) => void;
};

const ACTIONS: {
  kind: ClientActionKind;
  label: string;
  activeLabel: string;
  icon: typeof Calendar;
}[] = [
  {
    kind: "schedule",
    label: "Agendar próximo contato",
    activeLabel: "Contato agendado",
    icon: Calendar,
  },
  {
    kind: "attendance",
    label: "Registrar atendimento",
    activeLabel: "Atendimento registrado",
    icon: MessageSquare,
  },
  {
    kind: "attachments",
    label: "Adicionar arquivos",
    activeLabel: "Arquivos anexados",
    icon: Paperclip,
  },
];

function isActionActive(client: ClientListItem, kind: ClientActionKind): boolean {
  if (kind === "schedule") return client.hasSchedule;
  if (kind === "attendance") return client.hasAttendance;
  return client.hasAttachments;
}

export function ClientRowActions({ client, onAction }: Props) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-0.5">
        {ACTIONS.map(({ kind, label, activeLabel, icon: Icon }) => {
          const active = isActionActive(client, kind);
          return (
            <Tooltip key={kind}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-8",
                    active
                      ? "text-primary hover:text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={active ? activeLabel : label}
                  onClick={() => onAction(client, kind)}
                >
                  <Icon className={cn("size-4", active && "fill-primary")} strokeWidth={active ? 2.25 : 2} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{active ? activeLabel : label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
