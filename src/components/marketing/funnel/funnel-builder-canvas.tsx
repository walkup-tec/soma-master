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
  GitBranch,
  MessageSquareText,
  Flag,
  Timer,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FunnelStepNode } from "@/components/marketing/funnel/funnel-step-node";
import {
  FUNNEL_STEP_CATALOG,
  type FunnelDraft,
  type FunnelStepData,
  type FunnelStepKind,
} from "@/lib/marketing/funnel.types";

const nodeTypes = { funnelStep: FunnelStepNode };

const PALETTE_ICONS: Record<Exclude<FunnelStepKind, "start">, typeof Plus> = {
  message: MessageSquareText,
  wait: Timer,
  condition: GitBranch,
  end: Flag,
};

function FunnelCanvasInner({
  draft,
  onChange,
}: {
  draft: FunnelDraft;
  onChange: (next: FunnelDraft) => void;
}) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(draft.nodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(draft.edges as Edge[]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

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
      const catalog = FUNNEL_STEP_CATALOG.find((item) => item.kind === kind);
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
        data: {
          kind,
          label: catalog?.label ?? kind,
          description: catalog?.description ?? "",
        } satisfies FunnelStepData,
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
    (patch: Partial<FunnelStepData>) => {
      if (!selectedNodeId) return;
      setNodes((current) => {
        const next = current.map((node) =>
          node.id === selectedNodeId
            ? { ...node, data: { ...(node.data as FunnelStepData), ...patch } }
            : node,
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
    if ((node?.data as FunnelStepData | undefined)?.kind === "start") {
      toast.message("A etapa Início não pode ser removida.");
      return;
    }
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
            Etapas
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Clique para adicionar no centro do canvas.
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
        <div className="border-t border-border p-2 text-[10px] leading-relaxed text-muted-foreground">
          Arraste as etapas no canvas e conecte pelas bolinhas laterais.
        </div>
      </aside>

      <div className="relative min-h-0 min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={(changes) => {
            onNodesChange(changes);
          }}
          onEdgesChange={(changes) => {
            onEdgesChange(changes);
          }}
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
          <MiniMap
            pannable
            zoomable
            className="!rounded-lg !border !border-border !bg-card"
          />
        </ReactFlow>
      </div>

      <aside
        className={cn(
          "flex w-72 shrink-0 flex-col border-l border-border bg-card/80 transition-opacity",
          !selectedNode && "opacity-70",
        )}
      >
        <div className="border-b border-border px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Propriedades
          </p>
        </div>
        {selectedNode ? (
          <div className="space-y-3 p-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Título</label>
              <Input
                className="mt-1 h-9"
                value={(selectedNode.data as FunnelStepData).label}
                onChange={(event) => updateSelectedData({ label: event.target.value })}
                disabled={(selectedNode.data as FunnelStepData).kind === "start"}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">
                Descrição / conteúdo
              </label>
              <textarea
                className="mt-1 min-h-[110px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={(selectedNode.data as FunnelStepData).description ?? ""}
                onChange={(event) => updateSelectedData({ description: event.target.value })}
              />
            </div>
            {(selectedNode.data as FunnelStepData).kind !== "start" ? (
              <Button
                type="button"
                variant="outline"
                className="w-full cursor-pointer gap-1.5 text-destructive hover:text-destructive"
                onClick={deleteSelected}
              >
                <Trash2 className="size-3.5" />
                Remover etapa
              </Button>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                A etapa Início é fixa e marca a entrada do contato no funil.
              </p>
            )}
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            Selecione uma etapa no canvas para editar o conteúdo.
          </p>
        )}
      </aside>
    </div>
  );
}

export function FunnelBuilderCanvas({
  draft,
  onChange,
}: {
  draft: FunnelDraft;
  onChange: (next: FunnelDraft) => void;
}) {
  return (
    <ReactFlowProvider>
      <FunnelCanvasInner draft={draft} onChange={onChange} />
    </ReactFlowProvider>
  );
}
