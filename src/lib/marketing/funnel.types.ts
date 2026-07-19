export type FunnelStepKind = "start" | "message" | "wait" | "condition" | "end";

export type FunnelStepData = {
  kind: FunnelStepKind;
  label: string;
  description?: string;
};

export type FunnelDraft = {
  id: string;
  name: string;
  updatedAt: string;
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: FunnelStepData;
    deletable?: boolean;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>;
};

export const FUNNEL_STEP_CATALOG: Array<{
  kind: Exclude<FunnelStepKind, "start">;
  label: string;
  description: string;
}> = [
  {
    kind: "message",
    label: "Mensagem",
    description: "Envia texto no WhatsApp",
  },
  {
    kind: "wait",
    label: "Espera",
    description: "Aguarda um tempo ou resposta",
  },
  {
    kind: "condition",
    label: "Condição",
    description: "Ramifica o fluxo (sim/não)",
  },
  {
    kind: "end",
    label: "Fim",
    description: "Encerra o funil",
  },
];

export function createDefaultFunnelDraft(name = "Novo funil"): FunnelDraft {
  const id = `funnel-${crypto.randomUUID().slice(0, 8)}`;
  const startId = "step-start";
  const messageId = "step-message-1";
  const endId = "step-end";
  return {
    id,
    name,
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: startId,
        type: "funnelStep",
        position: { x: 80, y: 180 },
        deletable: false,
        data: {
          kind: "start",
          label: "Início",
          description: "Entrada do contato no funil",
        },
      },
      {
        id: messageId,
        type: "funnelStep",
        position: { x: 360, y: 160 },
        data: {
          kind: "message",
          label: "Mensagem de boas-vindas",
          description: "Olá! Bem-vindo ao atendimento.",
        },
      },
      {
        id: endId,
        type: "funnelStep",
        position: { x: 680, y: 180 },
        data: {
          kind: "end",
          label: "Fim",
          description: "Fluxo encerrado",
        },
      },
    ],
    edges: [
      { id: "e-start-msg", source: startId, target: messageId },
      { id: "e-msg-end", source: messageId, target: endId },
    ],
  };
}
