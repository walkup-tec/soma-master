import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Clock,
  Flag,
  Mail,
  Megaphone,
  Pause,
  Play,
  Split,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FUNNEL_FEEDBACK_HANDLES,
  formatPauseLabel,
  type FunnelStepData,
  type FunnelStepKind,
} from "@/lib/marketing/funnel.types";

const KIND_META: Record<
  FunnelStepKind,
  { icon: typeof Play; accent: string; ring: string }
> = {
  start: {
    icon: Play,
    accent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    ring: "border-emerald-500/40",
  },
  pause: {
    icon: Pause,
    accent: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    ring: "border-amber-500/40",
  },
  audience: {
    icon: Users,
    accent: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    ring: "border-sky-500/40",
  },
  disparo: {
    icon: Megaphone,
    accent: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    ring: "border-orange-500/40",
  },
  feedback: {
    icon: Split,
    accent: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    ring: "border-violet-500/40",
  },
  email_mkt: {
    icon: Mail,
    accent: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    ring: "border-indigo-500/40",
  },
  end: {
    icon: Flag,
    accent: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    ring: "border-rose-500/40",
  },
};

function subtitleFor(step: FunnelStepData): string {
  if (step.kind === "start" && step.start) {
    if (step.start.startedAt) return "Em andamento";
    if (step.start.mode === "scheduled" && step.start.scheduledAt) {
      return `Agendado · ${new Date(step.start.scheduledAt).toLocaleString("pt-BR")}`;
    }
    return "Início imediato";
  }
  if (step.kind === "pause" && step.pause) return formatPauseLabel(step.pause);
  if (step.kind === "audience" && step.audience) {
    if (step.audience.audienceCount != null) {
      return `${step.audience.audienceCount.toLocaleString("pt-BR")} contatos`;
    }
    if (step.audience.importRowCount != null) {
      return `Import · ${step.audience.importRowCount.toLocaleString("pt-BR")} linhas`;
    }
    return "Definir público";
  }
  if (step.kind === "disparo" && step.disparo) {
    if (step.disparo.wabaCampaignId) return `Campanha ${step.disparo.wabaCampaignId.slice(0, 8)}…`;
    return step.disparo.campaignName || "Configurar disparo";
  }
  if (step.kind === "email_mkt" && step.emailMkt) {
    return step.emailMkt.subject || "Assunto do e-mail";
  }
  return step.description || "";
}

function FunnelStepNodeComponent({ data, selected }: NodeProps) {
  const step = data as FunnelStepData;
  const meta = KIND_META[step.kind] ?? KIND_META.end;
  const Icon = meta.icon;
  const showTarget = step.kind !== "start";
  const showSource = step.kind !== "end" && step.kind !== "feedback";
  const isFeedback = step.kind === "feedback";
  const showScheduleBadge =
    step.kind === "start" &&
    step.start?.mode === "scheduled" &&
    !step.start.startedAt;

  return (
    <div
      className={cn(
        "relative min-w-[210px] max-w-[260px] rounded-xl border bg-card px-3 py-2.5 shadow-soft transition-shadow",
        meta.ring,
        selected && "ring-2 ring-primary shadow-md",
      )}
    >
      {showScheduleBadge ? (
        <span
          className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
          title="Início agendado — o indicador some quando o funil iniciar"
        >
          <Clock className="size-3" aria-hidden />
          Agendado
        </span>
      ) : null}

      {showTarget ? (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-2.5 !border-2 !border-background !bg-primary"
        />
      ) : null}

      <div className="flex items-start gap-2.5">
        <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", meta.accent)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{step.label}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {subtitleFor(step)}
          </p>
        </div>
      </div>

      {showSource ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2.5 !border-2 !border-background !bg-primary"
        />
      ) : null}

      {isFeedback
        ? FUNNEL_FEEDBACK_HANDLES.map((branch, index) => (
            <Handle
              key={branch.id}
              type="source"
              id={branch.id}
              position={Position.Right}
              style={{ top: `${22 + index * 28}%` }}
              className="!size-2.5 !border-2 !border-background !bg-violet-500"
            />
          ))
        : null}

      {isFeedback ? (
        <div className="pointer-events-none absolute -right-[7.5rem] top-[14%] space-y-3 text-[9px] font-medium text-violet-600 dark:text-violet-300">
          {FUNNEL_FEEDBACK_HANDLES.map((branch) => (
            <div key={branch.id} className="max-w-[7rem] leading-tight">
              {branch.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const FunnelStepNode = memo(FunnelStepNodeComponent);
