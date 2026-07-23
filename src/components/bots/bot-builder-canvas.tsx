import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
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
import { Copy, Trash2 } from "lucide-react";
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
  resolveBotNodeOutputs,
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

function cloneNodeData(data: BotNodeData): BotNodeData {
  return JSON.parse(JSON.stringify(data)) as BotNodeData;
}

function pruneInvalidOptionEdges(nodeId: string, data: BotNodeData, edges: Edge[]): Edge[] {
  if (data.kind !== "buttons" && data.kind !== "list" && data.kind !== "menu") return edges;
  const valid = new Set(resolveBotNodeOutputs(data).map((port) => port.id));
  return edges.filter((edge) => {
    if (edge.source !== nodeId) return true;
    if (!edge.sourceHandle) return true;
    return valid.has(edge.sourceHandle);
  });
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
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;

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
          setSelectedNodeIds([existing.id]);
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
        selected: true,
        data: createBotNodeData(kind),
      };
      setNodes((current) => {
        const next = [...current.map((item) => ({ ...item, selected: false })), node];
        nodesRef.current = next;
        persistGraph(next, edgesRef.current);
        return next;
      });
      setSelectedNodeIds([id]);
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
        setEdges((currentEdges) => {
          const nextEdges = pruneInvalidOptionEdges(selectedNodeId, nextData, currentEdges);
          edgesRef.current = nextEdges;
          persistGraph(next, nextEdges);
          return nextEdges;
        });
        return next;
      });
    },
    [persistGraph, selectedNodeId],
  );

  const duplicateSelected = useCallback(() => {
    const selected = nodesRef.current.filter((node) => selectedNodeIds.includes(node.id));
    if (selected.length === 0) return;

    const clonable = selected.filter(
      (node) => (node.data as BotNodeData | undefined)?.kind !== "start",
    );
    if (clonable.length === 0) {
      toast.message("O node Início não pode ser duplicado.");
      return;
    }

    const idMap = new Map<string, string>();
    const offset = { x: 48, y: 48 };
    const created: Node[] = clonable.map((node) => {
      const data = cloneNodeData(node.data as BotNodeData);
      const newId = `bot-${data.kind}-${crypto.randomUUID().slice(0, 6)}`;
      idMap.set(node.id, newId);
      return {
        ...node,
        id: newId,
        position: {
          x: (node.position?.x || 0) + offset.x,
          y: (node.position?.y || 0) + offset.y,
        },
        selected: true,
        data,
        deletable: true,
      };
    });

    const createdEdges: Edge[] = edgesRef.current
      .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
      .map((edge) => {
        const source = idMap.get(edge.source)!;
        const target = idMap.get(edge.target)!;
        const sourceHandle = edge.sourceHandle || "out";
        return {
          ...edge,
          id: `e-${source}-${sourceHandle}-${target}-${crypto.randomUUID().slice(0, 4)}`,
          source,
          target,
          selected: false,
        };
      });

    setNodes((current) => {
      const next = [
        ...current.map((node) => ({ ...node, selected: false })),
        ...created,
      ];
      nodesRef.current = next;
      setEdges((currentEdges) => {
        const nextEdges = [...currentEdges, ...createdEdges];
        edgesRef.current = nextEdges;
        persistGraph(next, nextEdges);
        return nextEdges;
      });
      return next;
    });
    setSelectedNodeIds(created.map((node) => node.id));
    toast.success(
      created.length === 1 ? "Node duplicado." : `${created.length} nodes duplicados.`,
    );
  }, [persistGraph, selectedNodeIds]);

  const deleteSelected = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const blocked = selectedNodeIds.some((id) => {
      const node = nodesRef.current.find((item) => item.id === id);
      return (node?.data as BotNodeData | undefined)?.kind === "start";
    });
    if (blocked && selectedNodeIds.length === 1) {
      toast.message("O node Início é obrigatório.");
      return;
    }

    const removeIds = new Set(
      selectedNodeIds.filter((id) => {
        const node = nodesRef.current.find((item) => item.id === id);
        return (node?.data as BotNodeData | undefined)?.kind !== "start";
      }),
    );
    if (removeIds.size === 0) {
      toast.message("O node Início é obrigatório.");
      return;
    }

    setNodes((current) => {
      const next = current.filter((item) => !removeIds.has(item.id));
      nodesRef.current = next;
      setEdges((currentEdges) => {
        const nextEdges = currentEdges.filter(
          (edge) => !removeIds.has(edge.source) && !removeIds.has(edge.target),
        );
        edgesRef.current = nextEdges;
        persistGraph(next, nextEdges);
        return nextEdges;
      });
      return next;
    });
    setSelectedNodeIds([]);
  }, [persistGraph, selectedNodeIds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedNodeIds.length > 0) {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, duplicateSelected, selectedNodeIds.length]);

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
            setSelectedNodeIds(selected.map((node) => node.id));
          }}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          panOnDrag={[1, 2]}
          multiSelectionKeyCode="Shift"
          deleteKeyCode={null}
          fitView
          minZoom={0.2}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>

        {selectedNodeIds.length > 0 ? (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="cursor-pointer gap-1.5"
              onClick={duplicateSelected}
            >
              <Copy className="size-3.5" />
              Duplicar{selectedNodeIds.length > 1 ? ` (${selectedNodeIds.length})` : ""}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="cursor-pointer gap-1.5"
              onClick={deleteSelected}
            >
              <Trash2 className="size-3.5" />
              Remover{selectedNodeIds.length > 1 ? ` (${selectedNodeIds.length})` : ""}
            </Button>
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-border/60 bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
          Arraste no fundo para selecionar · Shift+clique · botão do meio para pan · Ctrl+D duplica
        </div>
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
        ) : selectedNodeIds.length > 1 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 border-l border-border p-6 text-center">
            <p className="text-sm font-medium text-foreground">
              {selectedNodeIds.length} nodes selecionados
            </p>
            <p className="text-sm text-muted-foreground">
              Use Duplicar ou Remover na barra superior. Selecione um único node para configurar.
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" className="cursor-pointer gap-1.5" onClick={duplicateSelected}>
                <Copy className="size-3.5" />
                Duplicar todos
              </Button>
            </div>
          </div>
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
