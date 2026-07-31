import { memo, useLayoutEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Bot,
  Brain,
  Database,
  Flag,
  GitBranch,
  Image as ImageIcon,
  List,
  MessageSquare,
  Pause,
  Play,
  Repeat,
  Sparkles,
  Sun,
  Sunrise,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BOT_CATEGORY_META, getBotNodeDefinition, resolveBotNodeOutputs } from "@/lib/bots/bot-node.registry";
import type { BotNodeData, BotNodeKind } from "@/lib/bots/bot.types";

const KIND_ICON: Partial<Record<BotNodeKind, typeof Play>> = {
  start: Play,
  end: Flag,
  wait_reply: Pause,
  delay: Pause,
  condition: GitBranch,
  switch: GitBranch,
  loop: Repeat,
  message: MessageSquare,
  buttons: List,
  list: List,
  menu: List,
  image: ImageIcon,
  pdf: Database,
  audio: MessageSquare,
  video: ImageIcon,
  expediente: Sunrise,
  calc_margin: Sparkles,
  map_data: Brain,
  prompt: Brain,
  saudacao: Sun,
  confirm_data: Sparkles,
  create_lead: Database,
  update_lead: Database,
  add_tags: Bot,
  add_status: Bot,
  transfer_agent: Bot,
};

function BotFlowNodeComponent({ data, selected }: NodeProps) {
  const step = (data || {}) as BotNodeData;
  const definition = getBotNodeDefinition(step.kind);
  const meta = BOT_CATEGORY_META[step.category] || BOT_CATEGORY_META.chatbot;
  const Icon = KIND_ICON[step.kind] || Bot;
  const inputs = definition?.inputs || [];
  const outputs = resolveBotNodeOutputs({
    kind: step.kind || "message",
    config: step.config || {},
  });
  const alignHandlesToLabels =
    step.kind === "buttons" ||
    step.kind === "list" ||
    step.kind === "menu" ||
    step.kind === "condition" ||
    step.kind === "expediente" ||
    outputs.length > 2;

  const rootRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [handleTops, setHandleTops] = useState<Record<string, number>>({});

  const outputsKey = outputs.map((port) => `${port.id}:${port.label}`).join("|");

  useLayoutEffect(() => {
    if (!alignHandlesToLabels) return;
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const rootRect = root.getBoundingClientRect();
      if (rootRect.height <= 0) return;
      const next: Record<string, number> = {};
      for (const port of outputs) {
        const el = labelRefs.current[port.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        next[port.id] = rect.top - rootRect.top + rect.height / 2;
      }
      setHandleTops((prev) => {
        const same =
          Object.keys(next).length === Object.keys(prev).length &&
          Object.keys(next).every((key) => Math.abs((prev[key] ?? -1) - next[key]) < 0.5);
        return same ? prev : next;
      });
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    return () => ro.disconnect();
    // outputsKey cobre ids/labels; outputs é lido no measure atual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alignHandlesToLabels, outputsKey, step.title, step.status]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative min-w-[180px] max-w-[260px] rounded-xl border bg-card px-3 py-2.5 shadow-soft",
        meta.ring,
        selected && "ring-2 ring-primary/40",
      )}
    >
      {inputs.map((port, index) => (
        <Handle
          key={`in-${port.id}`}
          id={port.id}
          type="target"
          position={Position.Left}
          style={{ top: `${((index + 1) / (inputs.length + 1)) * 100}%` }}
          className="!size-2.5 !border-2 !border-background !bg-sky-500"
        />
      ))}

      <div className="flex items-start gap-2">
        <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", meta.accent)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{step.title || "Node"}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {meta.label} · {step.executionKind || "flow"}
          </p>
          {step.status && step.status !== "idle" ? (
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {step.status}
            </p>
          ) : null}
        </div>
      </div>

      {alignHandlesToLabels && outputs.length > 0 ? (
        <div className="mt-2 space-y-1 border-t border-border/50 pt-2 pr-3">
          {outputs.map((port) => (
            <div
              key={`lbl-${port.id}`}
              ref={(el) => {
                labelRefs.current[port.id] = el;
              }}
              className="flex min-h-5 items-center justify-end"
            >
              <span className="truncate text-right text-[10px] text-muted-foreground">{port.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Handles filhos do root — top em px alinhado ao centro de cada label. */}
      {outputs.map((port, index) => {
        const measured = handleTops[port.id];
        const top =
          alignHandlesToLabels && measured != null
            ? measured
            : `${((index + 1) / (outputs.length + 1)) * 100}%`;
        return (
          <Handle
            key={`out-${port.id}`}
            id={port.id}
            type="source"
            position={Position.Right}
            style={{ top }}
            className="!size-2.5 !border-2 !border-background !bg-violet-500"
            title={port.label}
          />
        );
      })}
    </div>
  );
}

export const BotFlowNode = memo(BotFlowNodeComponent);
