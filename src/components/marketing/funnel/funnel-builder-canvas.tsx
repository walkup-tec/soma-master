import { useCallback, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Flag,
  Mail,
  Megaphone,
  Pause,
  Split,
  Users,
} from "lucide-react";
import { FunnelStepNode } from "@/components/marketing/funnel/funnel-step-node";
import { FunnelStepEditor } from "@/components/marketing/funnel/funnel-step-editor";
import {
  FUNNEL_STEP_CATALOG,
  createStepData,
  type FunnelDraft,
  type FunnelStepData,
  type FunnelStepKind,
} from "@/lib/marketing/funnel.types";
import type { AttendanceStatusConfig, ProductConfig } from "@/lib/config/settings-types";
import { cn } from "@/lib/utils";

const nodeTypes = { funnelStep: FunnelStepNode };

const PALETTE_ICONS: Record<Exclude<FunnelStepKind, "start">, typeof Pause> = {
  pause: Pause,
  audience: Users,
  disparo: Megaphone,
  feedback: Split,
  email_mkt: Mail,
  end: Flag,
};

function FunnelCanvasInner({
  draft,
  onChange,
  products,
  attendanceStatuses,
}: {
  draft: FunnelDraft;
  onChange: (next: FunnelDraft) => void;
  products: ProductConfig[];
  attendanceStatuses: AttendanceStatusConfig[];
}) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(draft.nodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(draft.edges as Edge[]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  /** Contagem do nó Público mais próximo a montante (para sugerir qtd. no Disparo). */
  const upstreamAudienceCount = useMemo(() => {
    if (!selectedNodeId) return null;
    const visited = new Set<string>();
    const queue = [selectedNodeId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const edge of edges) {
        if (edge.target !== id) continue;
        const source = nodes.find((node) => node.id === edge.source);
        const data = source?.data as FunnelStepData | undefined;
        if (data?.kind === "audience") {
          return (
            data.audience?.audienceCount ??
            data.audience?.importRowCount ??
            null
          );
        }
        if (source) queue.push(source.id);
      }
    }
    return null;
  }, [selectedNodeId, nodes, edges]);

  const persist = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      onChange({
        ...draft,
        updatedAt: new Date().toISOString(),
        nodes: nextNodes.map((node) => ({
          id: node.id,
          type: node.type || "funnelStep",
          position: node.position,
          deletable: node.deletable,
          data: node.data as FunnelStepData,
        })),
        edges: nextEdges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          label: typeof edge.label === "string" ? edge.label : undefined,
        })),
      });
    },
    [draft, onChange],
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
        persist(nodes, next);
        return next;
      });
    },
    [nodes, persist, setEdges],
  );

  const addStep = useCallback(
    (kind: Exclude<FunnelStepKind, "start">) => {
      const id = `step-${kind}-${crypto.randomUUID().slice(0, 6)}`;
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const node: Node = {
        id,
        type: "funnelStep",
        position: { x: position.x - 100, y: position.y - 40 },
        deletable: true,
        data: createStepData(kind),
      };
      setNodes((current) => {
        const next = [...current, node];
        persist(next, edges);
        return next;
      });
      setSelectedNodeId(id);
      window.setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
    },
    [edges, fitView, persist, screenToFlowPosition, setNodes],
  );

  const updateSelectedData = useCallback(
    (nextData: FunnelStepData) => {
      if (!selectedNodeId) return;
      setNodes((current) => {
        const next = current.map((node) =>
          node.id === selectedNodeId ? { ...node, data: nextData } : node,
        );
        persist(next, edges);
        return next;
      });
    },
    [edges, persist, selectedNodeId, setNodes],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const node = nodes.find((item) => item.id === selectedNodeId);
    if ((node?.data as FunnelStepData | undefined)?.kind === "start") return;
    setNodes((current) => {
      const nextNodes = current.filter((item) => item.id !== selectedNodeId);
      setEdges((currentEdges) => {
        const nextEdges = currentEdges.filter(
          (edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId,
        );
        persist(nextNodes, nextEdges);
        return nextEdges;
      });
      return nextNodes;
    });
    setSelectedNodeId(null);
  }, [nodes, persist, selectedNodeId, setEdges, setNodes]);

  return (
    <div className="flex h-full min-h-0 w-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/80">
        <div className="border-b border-border px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Módulos
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Funil de prospecção — arraste e conecte no canvas.
          </p>
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
          {FUNNEL_STEP_CATALOG.map((item) => {
            const Icon = PALETTE_ICONS[item.kind];
            return (
              <button
                key={item.kind}
                type="button"
                onClick={() => addStep(item.kind)}
                className="flex w-full cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-muted"
              >
                <span className="mt-0.5 grid size-7 place-items-center rounded-md bg-muted text-foreground">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="relative min-h-0 min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={(_, __, nextNodes) => persist(nextNodes, edges)}
          onNodesDelete={(deleted) => {
            const deletedIds = new Set(deleted.map((node) => node.id));
            setNodes((currentNodes) => {
              const nextNodes = currentNodes.filter((node) => !deletedIds.has(node.id));
              setEdges((currentEdges) => {
                const nextEdges = currentEdges.filter(
                  (edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target),
                );
                persist(nextNodes, nextEdges);
                return nextEdges;
              });
              return nextNodes;
            });
            setSelectedNodeId(null);
          }}
          onSelectionChange={({ nodes: selected }) => {
            setSelectedNodeId(selected[0]?.id ?? null);
          }}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
          className="bg-muted/20"
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!rounded-lg !border !border-border !bg-card" />
        </ReactFlow>
      </div>

      <aside
        className={cn(
          "flex w-80 shrink-0 flex-col border-l border-border bg-card/80 transition-opacity",
          !selectedNode && "opacity-70",
        )}
      >
        <div className="border-b border-border px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Propriedades
          </p>
        </div>
        {selectedNode ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <FunnelStepEditor
              data={selectedNode.data as FunnelStepData}
              onChange={updateSelectedData}
              onDelete={deleteSelected}
              canDelete={(selectedNode.data as FunnelStepData).kind !== "start"}
              products={products}
              attendanceStatuses={attendanceStatuses}
              upstreamAudienceCount={upstreamAudienceCount}
            />
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            Selecione um módulo no canvas para configurar.
          </p>
        )}
      </aside>
    </div>
  );
}

export function FunnelBuilderCanvas({
  draft,
  onChange,
  products,
  attendanceStatuses,
}: {
  draft: FunnelDraft;
  onChange: (next: FunnelDraft) => void;
  products: ProductConfig[];
  attendanceStatuses: AttendanceStatusConfig[];
}) {
  return (
    <ReactFlowProvider>
      <FunnelCanvasInner
        draft={draft}
        onChange={onChange}
        products={products}
        attendanceStatuses={attendanceStatuses}
      />
    </ReactFlowProvider>
  );
}
