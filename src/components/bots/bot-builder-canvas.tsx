import { useCallback, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BotFlowNode } from "@/components/bots/bot-flow-node";
import { BotNodeConfigPanel } from "@/components/bots/bot-node-config-panel";
import {
  BOT_CATEGORY_META,
  BOT_NODE_REGISTRY,
  createBotNodeData,
  listBotNodesByCategory,
} from "@/lib/bots/bot-node.registry";
import type { BotFlowDraft, BotNodeCategory, BotNodeData, BotNodeKind } from "@/lib/bots/bot.types";
import type { AttendanceStatusConfig, ProductConfig } from "@/lib/config/settings-types";

const nodeTypes = { botStep: BotFlowNode };
const CATEGORIES: BotNodeCategory[] = ["chatbot", "ia", "sistema"];

function toFlowNodes(draft: BotFlowDraft): Node[] {
  return draft.nodes.map((node) => ({
    id: node.id,
    type: "botStep",
    position: { ...node.position },
    deletable: node.deletable,
    data: { ...node.data },
  }));
}

function toFlowEdges(draft: BotFlowDraft): Edge[] {
  return draft.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    label: edge.label,
    animated: true,
  }));
}

function serializeDraftGraph(base: BotFlowDraft, nextNodes: Node[], nextEdges: Edge[]): BotFlowDraft {
  return {
    id: base.id,
    name: base.name,
    updatedAt: new Date().toISOString(),
    nodes: nextNodes.map((node) => ({
      id: node.id,
      type: "botStep",
      position: {
        x: Number(node.position?.x) || 0,
        y: Number(node.position?.y) || 0,
      },
      deletable: node.deletable,
      data: { ...(node.data as BotNodeData) },
    })),
    edges: nextEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      label: typeof edge.label === "string" ? edge.label : undefined,
    })),
  };
}

function BotCanvasInner({
  draft,
  onChange,
  products,
  attendanceStatuses,
}: {
  draft: BotFlowDraft;
  onChange: (next: BotFlowDraft) => void;
  products: ProductConfig[];
  attendanceStatuses: AttendanceStatusConfig[];
}) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [nodes, setNodes] = useState<Node[]>(() => toFlowNodes(draft));
  const [edges, setEdges] = useState<Edge[]>(() => toFlowEdges(draft));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const persistGraph = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      onChange(serializeDraftGraph(draft, nextNodes, nextEdges));
    },
    [draft, onChange],
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((current) => {
        const next = applyNodeChanges(changes, current);
        nodesRef.current = next;
        const shouldPersist = changes.some(
          (change) =>
            change.type === "position" ||
            change.type === "remove" ||
            change.type === "add" ||
            change.type === "replace",
        );
        if (shouldPersist) {
          const onlyDrag =
            changes.length > 0 &&
            changes.every((change) => change.type === "position" && "dragging" in change && change.dragging);
          if (!onlyDrag) persistGraph(next, edgesRef.current);
          else if (changes.some((change) => change.type === "position" && "dragging" in change && change.dragging === false)) {
            persistGraph(next, edgesRef.current);
          }
        }
        return next;
      });
    },
    [persistGraph],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((current) => {
        const next = applyEdgeChanges(changes, current);
        edgesRef.current = next;
        const shouldPersist = changes.some(
          (change) =>
            change.type === "remove" ||
            change.type === "add" ||
            change.type === "replace",
        );
        if (shouldPersist) persistGraph(nodesRef.current, next);
        return next;
      });
    },
    [persistGraph],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => {
        const next = addEdge(
          {
            ...connection,
            id: `e-${connection.source}-${connection.sourceHandle || "out"}-${connection.target}`,
            animated: true,
          },
          current,
        );
        edgesRef.current = next;
        persistGraph(nodesRef.current, next);
        return next;
      });
    },
    [persistGraph],
  );

  const addNode = useCallback(
    (kind: BotNodeKind) => {
      if (kind === "start") {
        const existing = nodesRef.current.find(
          (node) => (node.data as BotNodeData | undefined)?.kind === "start",
        );
        if (existing) {
          setSelectedNodeId(existing.id);
          toast.message("O fluxo já tem Início.");
          return;
        }
      }
      const id = kind === "start" ? "bot-start" : `bot-${kind}-${crypto.randomUUID().slice(0, 6)}`;
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const node: Node = {
        id,
        type: "botStep",
        position: { x: position.x - 100, y: position.y - 40 },
        deletable: kind !== "start",
        data: createBotNodeData(kind),
      };
      setNodes((current) => {
        const next = [...current, node];
        nodesRef.current = next;
        persistGraph(next, edgesRef.current);
        return next;
      });
      setSelectedNodeId(id);
      window.setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
    },
    [fitView, persistGraph, screenToFlowPosition],
  );

  const selectedData = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = nodes.find((item) => item.id === selectedNodeId);
    return node ? (node.data as BotNodeData) : null;
  }, [nodes, selectedNodeId]);

  const updateSelectedData = useCallback(
    (nextData: BotNodeData) => {
      if (!selectedNodeId) return;
      setNodes((current) => {
        const next = current.map((node) =>
          node.id === selectedNodeId ? { ...node, data: nextData } : node,
        );
        nodesRef.current = next;
        persistGraph(next, edgesRef.current);
        return next;
      });
    },
    [persistGraph, selectedNodeId],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const node = nodesRef.current.find((item) => item.id === selectedNodeId);
    if ((node?.data as BotNodeData | undefined)?.kind === "start") {
      toast.message("O node Início é obrigatório.");
      return;
    }
    setNodes((current) => {
      const next = current.filter((item) => item.id !== selectedNodeId);
      nodesRef.current = next;
      setEdges((currentEdges) => {
        const nextEdges = currentEdges.filter(
          (edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId,
        );
        edgesRef.current = nextEdges;
        persistGraph(next, nextEdges);
        return nextEdges;
      });
      return next;
    });
    setSelectedNodeId(null);
  }, [persistGraph, selectedNodeId]);

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/10">
        <div className="border-b border-border px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nodes · {BOT_NODE_REGISTRY.length}
          </p>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-3">
            {CATEGORIES.map((category) => (
              <div key={category}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {BOT_CATEGORY_META[category].label}
                </p>
                <div className="space-y-1">
                  {listBotNodesByCategory(category).map((item) => (
                    <button
                      key={item.kind}
                      type="button"
                      className="flex w-full cursor-pointer items-center rounded-lg border border-border/60 bg-card px-2 py-1.5 text-left text-xs font-medium transition hover:bg-muted/50"
                      onClick={() => addNode(item.kind)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="relative min-h-0 min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={({ nodes: selected }) => {
            setSelectedNodeId(selected[0]?.id || null);
          }}
          fitView
          minZoom={0.2}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>

        {selectedNodeId ? (
          <div className="absolute right-3 top-3 z-10">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="cursor-pointer gap-1.5"
              onClick={deleteSelected}
            >
              <Trash2 className="size-3.5" />
              Remover
            </Button>
          </div>
        ) : null}
      </div>

      <aside className="w-[340px] shrink-0">
        {selectedData && selectedNodeId ? (
          <BotNodeConfigPanel
            nodeId={selectedNodeId}
            data={selectedData}
            onChange={updateSelectedData}
            products={products}
            attendanceStatuses={attendanceStatuses}
          />
        ) : (
          <div className="flex h-full items-center justify-center border-l border-border p-6 text-center text-sm text-muted-foreground">
            Selecione um node para configurar, ver I/O, variáveis, logs e testar.
          </div>
        )}
      </aside>
    </div>
  );
}

export function BotBuilderCanvas(props: {
  draft: BotFlowDraft;
  onChange: (next: BotFlowDraft) => void;
  products: ProductConfig[];
  attendanceStatuses: AttendanceStatusConfig[];
}) {
  return (
    <ReactFlowProvider>
      <BotCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
