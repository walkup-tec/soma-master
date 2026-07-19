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
import {
  Flag,
  Mail,
  Megaphone,
  Pause,
  Play,
  Settings2,
  Split,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FunnelStepNode } from "@/components/marketing/funnel/funnel-step-node";
import { FunnelStepConfigModal } from "@/components/marketing/funnel/funnel-step-config-modal";
import {
  FUNNEL_STEP_CATALOG,
  createStepData,
  type FunnelDraft,
  type FunnelStepData,
  type FunnelStepKind,
} from "@/lib/marketing/funnel.types";
import type { AttendanceStatusConfig, ProductConfig } from "@/lib/config/settings-types";

const nodeTypes = { funnelStep: FunnelStepNode };

const PALETTE_ICONS: Record<FunnelStepKind, typeof Pause> = {
  start: Play,
  pause: Pause,
  audience: Users,
  disparo: Megaphone,
  feedback: Split,
  email_mkt: Mail,
  end: Flag,
};

function toFlowNodes(draft: FunnelDraft): Node[] {
  return draft.nodes.map((node) => ({
    id: node.id,
    type: node.type || "funnelStep",
    position: { ...node.position },
    deletable: node.deletable,
    data: { ...node.data },
  }));
}

function toFlowEdges(draft: FunnelDraft): Edge[] {
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

function serializeDraftGraph(
  base: FunnelDraft,
  nextNodes: Node[],
  nextEdges: Edge[],
): FunnelDraft {
  return {
    id: base.id,
    name: base.name,
    updatedAt: new Date().toISOString(),
    nodes: nextNodes.map((node) => ({
      id: node.id,
      type: node.type || "funnelStep",
      position: {
        x: Number(node.position?.x) || 0,
        y: Number(node.position?.y) || 0,
      },
      deletable: node.deletable,
      data: { ...(node.data as FunnelStepData) },
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
  const [nodes, setNodes] = useState<Node[]>(() => toFlowNodes(draft));
  const [edges, setEdges] = useState<Edge[]>(() => toFlowEdges(draft));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const draftRef = useRef(draft);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  draftRef.current = draft;
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const persistGraph = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      onChange(serializeDraftGraph(draftRef.current, nextNodes, nextEdges));
    },
    [onChange],
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

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

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const startIds = new Set(
        nodesRef.current
          .filter((node) => (node.data as FunnelStepData | undefined)?.kind === "start")
          .map((node) => node.id),
      );
      const safeChanges = changes.filter(
        (change) => !(change.type === "remove" && startIds.has(change.id)),
      );
      if (safeChanges.length === 0) return;

      setNodes((current) => {
        const next = applyNodeChanges(safeChanges, current);
        nodesRef.current = next;
        const shouldPersist = safeChanges.some(
          (change) =>
            change.type === "remove" ||
            change.type === "add" ||
            change.type === "replace" ||
            change.type === "reset" ||
            (change.type === "position" && change.dragging === false),
        );
        if (shouldPersist) {
          persistGraph(next, edgesRef.current);
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
            change.type === "replace" ||
            change.type === "reset",
        );
        if (shouldPersist) {
          persistGraph(nodesRef.current, next);
        }
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

  const addStep = useCallback(
    (kind: FunnelStepKind) => {
      if (kind === "start") {
        const existing = nodesRef.current.find(
          (node) => (node.data as FunnelStepData | undefined)?.kind === "start",
        );
        if (existing) {
          setSelectedNodeId(existing.id);
          setConfigOpen(true);
          toast.message("O funil já tem Iniciar — configure imediato ou agendado.");
          return;
        }
      }
      const id = kind === "start" ? "step-start" : `step-${kind}-${crypto.randomUUID().slice(0, 6)}`;
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const node: Node = {
        id,
        type: "funnelStep",
        position: { x: position.x - 100, y: position.y - 40 },
        deletable: kind !== "start",
        data: createStepData(kind),
      };
      setNodes((current) => {
        const next = [...current, node];
        nodesRef.current = next;
        persistGraph(next, edgesRef.current);
        return next;
      });
      setSelectedNodeId(id);
      setConfigOpen(true);
      window.setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
    },
    [fitView, persistGraph, screenToFlowPosition],
  );

  const updateSelectedData = useCallback(
    (nextData: FunnelStepData) => {
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
    if ((node?.data as FunnelStepData | undefined)?.kind === "start") {
      toast.message("O módulo Iniciar é obrigatório e não pode ser removido.");
      return;
    }
    const nextNodes = nodesRef.current.filter((item) => item.id !== selectedNodeId);
    const nextEdges = edgesRef.current.filter(
      (edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId,
    );
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
    persistGraph(nextNodes, nextEdges);
    setSelectedNodeId(null);
    setConfigOpen(false);
  }, [persistGraph, selectedNodeId]);

  return (
    <div className="flex h-full min-h-0 w-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/80">
        <div className="border-b border-border px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Módulos
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Clique para adicionar. Duplo clique no canvas abre a configuração.
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
          onNodeDoubleClick={(_, node) => {
            setSelectedNodeId(node.id);
            setConfigOpen(true);
          }}
          onSelectionChange={({ nodes: selected }) => {
            const id = selected[0]?.id ?? null;
            setSelectedNodeId(id);
            if (!id) setConfigOpen(false);
          }}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          deleteKeyCode={["Delete"]}
          proOptions={{ hideAttribution: true }}
          className="bg-muted/20"
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          <Controls
            showInteractive={false}
            className="!overflow-hidden !rounded-lg !border !border-border !bg-card !shadow-soft"
          />
          <MiniMap
            pannable
            zoomable
            className="!rounded-lg !border !border-border !bg-card"
            maskColor="color-mix(in oklab, var(--background) 70%, transparent)"
          />
        </ReactFlow>

        {selectedNode ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
            <div className="pointer-events-auto flex max-w-xl flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-elevated backdrop-blur">
              <div className="min-w-0 flex-1 px-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {(selectedNode.data as FunnelStepData).label}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {(selectedNode.data as FunnelStepData).description ||
                    "Duplo clique ou Configurar para editar"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="cursor-pointer gap-1.5"
                onClick={() => setConfigOpen(true)}
              >
                <Settings2 className="size-3.5" />
                Configurar
              </Button>
              {(selectedNode.data as FunnelStepData).kind !== "start" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer gap-1.5 text-destructive hover:text-destructive"
                  onClick={deleteSelected}
                >
                  <Trash2 className="size-3.5" />
                  Remover
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {selectedNode && configOpen ? (
          <FunnelStepConfigModal
            open={configOpen}
            onOpenChange={setConfigOpen}
            data={selectedNode.data as FunnelStepData}
            onChange={updateSelectedData}
            onDelete={deleteSelected}
            canDelete={(selectedNode.data as FunnelStepData).kind !== "start"}
            products={products}
            attendanceStatuses={attendanceStatuses}
            upstreamAudienceCount={upstreamAudienceCount}
          />
        ) : null}
      </div>
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
