import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch, MessageSquareText, Flag, Timer, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FunnelStepData, FunnelStepKind } from "@/lib/marketing/funnel.types";

const KIND_META: Record<
  FunnelStepKind,
  { icon: typeof Play; accent: string; ring: string }
> = {
  start: {
    icon: Play,
    accent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    ring: "border-emerald-500/40",
  },
  message: {
    icon: MessageSquareText,
    accent: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    ring: "border-sky-500/40",
  },
  wait: {
    icon: Timer,
    accent: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    ring: "border-amber-500/40",
  },
  condition: {
    icon: GitBranch,
    accent: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    ring: "border-violet-500/40",
  },
  end: {
    icon: Flag,
    accent: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    ring: "border-rose-500/40",
  },
};

function FunnelStepNodeComponent({ data, selected }: NodeProps) {
  const step = data as FunnelStepData;
  const meta = KIND_META[step.kind] ?? KIND_META.message;
  const Icon = meta.icon;
  const showTarget = step.kind !== "start";
  const showSource = step.kind !== "end";
  const isCondition = step.kind === "condition";

  return (
    <div
      className={cn(
        "relative min-w-[200px] max-w-[240px] rounded-xl border bg-card px-3 py-2.5 shadow-soft transition-shadow",
        meta.ring,
        selected && "ring-2 ring-primary shadow-md",
      )}
    >
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
          {step.description ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {step.description}
            </p>
          ) : null}
        </div>
      </div>

      {showSource && !isCondition ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2.5 !border-2 !border-background !bg-primary"
        />
      ) : null}

      {isCondition ? (
        <>
          <Handle
            type="source"
            id="yes"
            position={Position.Right}
            style={{ top: "35%" }}
            className="!size-2.5 !border-2 !border-background !bg-emerald-500"
          />
          <Handle
            type="source"
            id="no"
            position={Position.Right}
            style={{ top: "70%" }}
            className="!size-2.5 !border-2 !border-background !bg-rose-500"
          />
          <div className="pointer-events-none absolute -right-10 top-[28%] text-[9px] font-medium text-emerald-600">
            sim
          </div>
          <div className="pointer-events-none absolute -right-10 top-[63%] text-[9px] font-medium text-rose-600">
            não
          </div>
        </>
      ) : null}
    </div>
  );
}

export const FunnelStepNode = memo(FunnelStepNodeComponent);
