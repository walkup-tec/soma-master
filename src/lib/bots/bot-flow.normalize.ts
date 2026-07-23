import {
  createBotNodeData,
  getBotNodeDefinition,
} from "@/lib/bots/bot-node.registry";
import type {
  BotFlowDraft,
  BotFlowEdge,
  BotFlowNode,
  BotJson,
  BotNodeData,
} from "@/lib/bots/bot.types";

export function createDefaultBotDraft(name = "Novo bot"): BotFlowDraft {
  const startId = "bot-start";
  const start: BotFlowNode = {
    id: startId,
    type: "botStep",
    position: { x: 80, y: 180 },
    deletable: false,
    data: createBotNodeData("start"),
  };
  return {
    id: `bot-${crypto.randomUUID().slice(0, 8)}`,
    name,
    updatedAt: new Date().toISOString(),
    nodes: [start],
    edges: [],
  };
}

export function ensureBotHasStart(draft: BotFlowDraft): BotFlowDraft {
  const hasStart = draft.nodes.some((node) => node.data?.kind === "start");
  if (hasStart) return draft;
  const start: BotFlowNode = {
    id: "bot-start",
    type: "botStep",
    position: { x: 80, y: 180 },
    deletable: false,
    data: createBotNodeData("start"),
  };
  return { ...draft, nodes: [start, ...draft.nodes] };
}

export function normalizeBotDraft(raw: unknown): BotFlowDraft {
  const input = (raw && typeof raw === "object" ? raw : {}) as Partial<BotFlowDraft>;
  const nodes: BotFlowNode[] = Array.isArray(input.nodes)
    ? input.nodes.map((node, index) => {
        const kind = (node?.data as BotNodeData | undefined)?.kind || "message";
        const definition = getBotNodeDefinition(kind);
        const data = (node?.data as BotNodeData | undefined) || createBotNodeData("message");
        return {
          id: String(node?.id || `node-${index}`),
          type: "botStep",
          position: {
            x: Number(node?.position?.x) || 0,
            y: Number(node?.position?.y) || 0,
          },
          deletable: node?.deletable ?? kind !== "start",
          data: {
            ...createBotNodeData(definition?.kind || "message"),
            ...data,
            kind: definition?.kind || "message",
            category: definition?.category || data.category || "chatbot",
            executionKind: definition?.executionKind || data.executionKind || "flow",
            title: data.title || definition?.label || "Node",
            config: { ...(definition?.defaultConfig || {}), ...(data.config || {}) },
            variables:
              data.variables && typeof data.variables === "object"
                ? (data.variables as Record<string, BotJson>)
                : {},
            logs: Array.isArray(data.logs) ? data.logs : [],
            status: data.status || "idle",
          },
        };
      })
    : [];

  const edges: BotFlowEdge[] = Array.isArray(input.edges)
    ? input.edges.map((edge, index) => ({
        id: String(edge?.id || `e-${index}`),
        source: String(edge?.source || ""),
        target: String(edge?.target || ""),
        sourceHandle: edge?.sourceHandle ?? null,
        targetHandle: edge?.targetHandle ?? null,
        label: typeof edge?.label === "string" ? edge.label : undefined,
      }))
    : [];

  return {
    id: String(input.id || `bot-${crypto.randomUUID().slice(0, 8)}`),
    name: String(input.name || "Bot sem nome"),
    updatedAt: String(input.updatedAt || new Date().toISOString()),
    nodes,
    edges,
  };
}
