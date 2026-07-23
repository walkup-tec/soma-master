import { memo } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BOT_CATEGORY_META, getBotNodeDefinition } from "@/lib/bots/bot-node.registry";
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
  calc_margin: Sparkles,
  map_data: Brain,
  prompt: Brain,
  confirm_data: Sparkles,
  create_lead: Database,
  update_lead: Database,
  add_tags: Bot,
  add_status: Bot,
  transfer_agent: Bot,
};

function BotFlowNodeComponent({ data, selected }: NodeProps) {
  const step = data as BotNodeData;
  const definition = getBotNodeDefinition(step.kind);
  const meta = BOT_CATEGORY_META[step.category] || BOT_CATEGORY_META.chatbot;
  const Icon = KIND_ICON[step.kind] || Bot;
  const inputs = definition?.inputs || [];
  const outputs = definition?.outputs || [];

  return (
    <div
      className={cn(
        "min-w-[180px] max-w-[240px] rounded-xl border bg-card px-3 py-2.5 shadow-soft",
        meta.ring,
        selected && "ring-2 ring-primary/40",
      )}
    >
      {inputs.map((port, index) => (
        <Handle
          key={port.id}
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
          <p className="truncate text-sm font-semibold text-foreground">{step.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {meta.label} · {step.executionKind}
          </p>
          {step.status !== "idle" ? (
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {step.status}
            </p>
          ) : null}
        </div>
      </div>

      {outputs.map((port, index) => (
        <Handle
          key={port.id}
          id={port.id}
          type="source"
          position={Position.Right}
          style={{ top: `${((index + 1) / (outputs.length + 1)) * 100}%` }}
          className="!size-2.5 !border-2 !border-background !bg-violet-500"
          title={port.label}
        />
      ))}
    </div>
  );
}

export const BotFlowNode = memo(BotFlowNodeComponent);
