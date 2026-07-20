import type { ClientBulkFilters } from "@/lib/clients/client.types";

/** Módulos do funil de prospecção (não é robô de atendimento). */
export type FunnelStepKind =
  | "start"
  | "pause"
  | "audience"
  | "disparo"
  | "feedback"
  | "email_mkt"
  | "end";

export type FunnelPauseUnit = "minutes" | "hours" | "days" | "months";

export type FunnelStartConfig = {
  mode: "immediate" | "scheduled";
  /** ISO datetime local quando mode === scheduled */
  scheduledAt: string | null;
  /** Preenchido em runtime quando o funil efetivamente inicia */
  startedAt: string | null;
};

export type FunnelPauseConfig = {
  amount: number;
  unit: FunnelPauseUnit;
};

export type FunnelAudienceSource = "filters" | "import";

export type FunnelAudienceConfig = {
  source: FunnelAudienceSource;
  filters: ClientBulkFilters;
  /** Tags futuras — UI já captura labels */
  tags: string[];
  /** Contagem cacheada na última consulta */
  audienceCount: number | null;
  importFileName: string | null;
  importRowCount: number | null;
};

export type FunnelDisparoWorkingDay = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";

export const FUNNEL_DISPARO_WORKING_DAY_OPTIONS: Array<{
  id: FunnelDisparoWorkingDay;
  label: string;
}> = [
  { id: "seg", label: "Seg" },
  { id: "ter", label: "Ter" },
  { id: "qua", label: "Qua" },
  { id: "qui", label: "Qui" },
  { id: "sex", label: "Sex" },
  { id: "sab", label: "Sáb" },
  { id: "dom", label: "Dom" },
];

export const DEFAULT_FUNNEL_DISPARO_WORKING_DAYS: FunnelDisparoWorkingDay[] = [
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
];

export function normalizeFunnelWorkingDays(
  input: unknown,
  options?: { allowEmpty?: boolean },
): FunnelDisparoWorkingDay[] {
  const allowed = new Set(FUNNEL_DISPARO_WORKING_DAY_OPTIONS.map((d) => d.id));
  const raw = Array.isArray(input) ? input : null;
  if (raw === null) return [...DEFAULT_FUNNEL_DISPARO_WORKING_DAYS];
  const days = raw
    .map((d) => String(d || "").toLowerCase().trim())
    .filter((d): d is FunnelDisparoWorkingDay => allowed.has(d as FunnelDisparoWorkingDay));
  const unique = Array.from(new Set(days));
  if (unique.length > 0) return unique;
  if (options?.allowEmpty) return [];
  return [...DEFAULT_FUNNEL_DISPARO_WORKING_DAYS];
}

export type FunnelDisparoConfig = {
  campaignName: string;
  plannedSendCount: number;
  /** Alternativa WABA: modo IA (database existe no WABA; fixed não faz parte do motor Alternativa). */
  messageMode: "ai";
  aiBriefing: string;
  aiTone: string;
  aiCta: string;
  aiAudience: string;
  linkDestinationMode: "whatsapp" | "url";
  whatsappTargetNumber: string;
  responseUrl: string;
  /** Expediente — WABA calcula delays a partir destes horários + dias */
  startHour: number;
  endHour: number;
  workingDays: FunnelDisparoWorkingDay[];
  /** [] = todas as instâncias conectadas */
  selectedInstanceNames: string[];
  wabaCampaignId: string | null;
  lastGenerateError: string | null;
};

export type FunnelFeedbackBranch = "clicked" | "clicked_no_chat" | "not_clicked";

export type FunnelEmailMktConfig = {
  subject: string;
  body: string;
};

export type FunnelStepData = {
  kind: FunnelStepKind;
  label: string;
  description?: string;
  start?: FunnelStartConfig;
  pause?: FunnelPauseConfig;
  audience?: FunnelAudienceConfig;
  disparo?: FunnelDisparoConfig;
  emailMkt?: FunnelEmailMktConfig;
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
    label?: string;
  }>;
};

const FUNNEL_KINDS = new Set<FunnelStepKind>([
  "start",
  "pause",
  "audience",
  "disparo",
  "feedback",
  "email_mkt",
  "end",
]);

/** Garante shape válido após localStorage / clones. */
export function normalizeFunnelDraft(raw: FunnelDraft): FunnelDraft {
  const nodes = Array.isArray(raw?.nodes)
    ? raw.nodes
        .filter((node) => node && typeof node.id === "string")
        .map((node) => {
          const rawData = (node.data ?? {}) as Partial<FunnelStepData>;
          const kind = FUNNEL_KINDS.has(rawData.kind as FunnelStepKind)
            ? (rawData.kind as FunnelStepKind)
            : "end";
          const fallback = createStepData(kind);
          return {
            id: node.id,
            type: node.type || "funnelStep",
            position: {
              x: Number(node.position?.x) || 0,
              y: Number(node.position?.y) || 0,
            },
            deletable: node.deletable,
            data: {
              ...fallback,
              ...rawData,
              kind,
              label: String(rawData.label || fallback.label),
            } as FunnelStepData,
          };
        })
    : [];
  const edges = Array.isArray(raw?.edges)
    ? raw.edges.filter(
        (edge) =>
          edge &&
          typeof edge.id === "string" &&
          typeof edge.source === "string" &&
          typeof edge.target === "string",
      )
    : [];
  return {
    id: String(raw?.id || `funnel-${crypto.randomUUID().slice(0, 8)}`),
    name: String(raw?.name || "Funil sem nome"),
    updatedAt: String(raw?.updatedAt || new Date().toISOString()),
    nodes,
    edges,
  };
}


export const FUNNEL_FEEDBACK_HANDLES: Array<{
  id: FunnelFeedbackBranch;
  label: string;
  hint: string;
}> = [
  {
    id: "clicked",
    label: "Quem clicou",
    hint: "Recebeu, clicou no link encurtado",
  },
  {
    id: "clicked_no_chat",
    label: "Clicou e não chamou",
    hint: "Clicou, mas não abriu Chat WhatsApp",
  },
  {
    id: "not_clicked",
    label: "Não clicou",
    hint: "Recebeu e não clicou no link",
  },
];

export const FUNNEL_STEP_CATALOG: Array<{
  kind: FunnelStepKind;
  label: string;
  description: string;
}> = [
  {
    kind: "start",
    label: "Iniciar",
    description: "Imediato ou agendado",
  },
  {
    kind: "pause",
    label: "Pausa",
    description: "Aguarda minutos, horas, dias ou meses",
  },
  {
    kind: "audience",
    label: "Público",
    description: "Filtros, tags, importação e contagem",
  },
  {
    kind: "disparo",
    label: "Disparo",
    description: "Campanha API Alternativa no WABA",
  },
  {
    kind: "feedback",
    label: "Feedback",
    description: "Ramifica por clique / chat",
  },
  {
    kind: "email_mkt",
    label: "E-mail Mkt",
    description: "Assunto + texto com variáveis",
  },
  {
    kind: "end",
    label: "Fim",
    description: "Encerra o funil",
  },
];

/** Garante exatamente um nó Iniciar (obrigatório no funil). */
export function ensureFunnelHasStart(draft: FunnelDraft): FunnelDraft {
  const normalized = normalizeFunnelDraft(draft);
  const startNodes = normalized.nodes.filter((node) => node.data.kind === "start");
  if (startNodes.length === 1) {
    return {
      ...normalized,
      nodes: normalized.nodes.map((node) =>
        node.data.kind === "start" ? { ...node, deletable: false } : node,
      ),
    };
  }
  if (startNodes.length > 1) {
    const keepId = startNodes[0]!.id;
    return {
      ...normalized,
      nodes: normalized.nodes
        .filter((node) => node.data.kind !== "start" || node.id === keepId)
        .map((node) =>
          node.data.kind === "start" ? { ...node, deletable: false } : node,
        ),
    };
  }
  const startNode = {
    id: "step-start",
    type: "funnelStep",
    position: { x: 40, y: 220 },
    deletable: false,
    data: createStepData("start"),
  };
  return {
    ...normalized,
    nodes: [startNode, ...normalized.nodes],
  };
}

export function defaultStartConfig(): FunnelStartConfig {
  return { mode: "immediate", scheduledAt: null, startedAt: null };
}

export function defaultPauseConfig(): FunnelPauseConfig {
  return { amount: 1, unit: "days" };
}

export function defaultAudienceConfig(): FunnelAudienceConfig {
  return {
    source: "filters",
    filters: {
      search: "",
      productIds: [],
      statuses: [],
      attendance: "all",
      schedule: "all",
    },
    tags: [],
    audienceCount: null,
    importFileName: null,
    importRowCount: null,
  };
}

export function defaultDisparoConfig(): FunnelDisparoConfig {
  return {
    campaignName: "",
    plannedSendCount: 0,
    messageMode: "ai",
    aiBriefing: "",
    aiTone: "consultivo",
    aiCta: "Responda no link abaixo",
    aiAudience: "CORBAN",
    linkDestinationMode: "whatsapp",
    whatsappTargetNumber: "",
    responseUrl: "",
    startHour: 8,
    endHour: 22,
    workingDays: [...DEFAULT_FUNNEL_DISPARO_WORKING_DAYS],
    selectedInstanceNames: [],
    wabaCampaignId: null,
    lastGenerateError: null,
  };
}

export function defaultEmailMktConfig(): FunnelEmailMktConfig {
  return {
    subject: "Olá, {{nome}}",
    body: "Olá {{nome}},\n\nTemos uma novidade para você.\n\nAtenciosamente,",
  };
}

export function createStepData(kind: FunnelStepKind): FunnelStepData {
  switch (kind) {
    case "start":
      return {
        kind,
        label: "Iniciar",
        description: "Imediato ou agendado",
        start: defaultStartConfig(),
      };
    case "pause":
      return {
        kind,
        label: "Pausa",
        description: "1 dia",
        pause: defaultPauseConfig(),
      };
    case "audience":
      return {
        kind,
        label: "Público",
        description: "Definir audiência",
        audience: defaultAudienceConfig(),
      };
    case "disparo":
      return {
        kind,
        label: "Disparo",
        description: "Campanha WhatsApp",
        disparo: defaultDisparoConfig(),
      };
    case "feedback":
      return {
        kind,
        label: "Feedback",
        description: "Clique / chat",
      };
    case "email_mkt":
      return {
        kind,
        label: "E-mail Mkt",
        description: "Assunto + mensagem",
        emailMkt: defaultEmailMktConfig(),
      };
    case "end":
      return {
        kind,
        label: "Fim",
        description: "Encerra o funil",
      };
  }
}

export function formatPauseLabel(config: FunnelPauseConfig): string {
  const n = Math.max(1, Math.floor(config.amount || 1));
  const map: Record<FunnelPauseUnit, [string, string]> = {
    minutes: ["minuto", "minutos"],
    hours: ["hora", "horas"],
    days: ["dia", "dias"],
    months: ["mês", "meses"],
  };
  const [one, many] = map[config.unit];
  return `${n} ${n === 1 ? one : many}`;
}

export function createDefaultFunnelDraft(name = "Novo funil de prospecção"): FunnelDraft {
  const id = `funnel-${crypto.randomUUID().slice(0, 8)}`;
  const startId = "step-start";
  const audienceId = "step-audience";
  const disparoId = "step-disparo";
  const feedbackId = "step-feedback";
  const endClickedId = "step-end-clicked";
  const endNoChatId = "step-end-no-chat";
  const endNoClickId = "step-end-no-click";

  return {
    id,
    name,
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: startId,
        type: "funnelStep",
        position: { x: 40, y: 220 },
        deletable: false,
        data: createStepData("start"),
      },
      {
        id: audienceId,
        type: "funnelStep",
        position: { x: 280, y: 200 },
        data: createStepData("audience"),
      },
      {
        id: disparoId,
        type: "funnelStep",
        position: { x: 540, y: 200 },
        data: createStepData("disparo"),
      },
      {
        id: feedbackId,
        type: "funnelStep",
        position: { x: 820, y: 180 },
        data: createStepData("feedback"),
      },
      {
        id: endClickedId,
        type: "funnelStep",
        position: { x: 1120, y: 40 },
        data: { ...createStepData("end"), label: "Fim · Clicou" },
      },
      {
        id: endNoChatId,
        type: "funnelStep",
        position: { x: 1120, y: 200 },
        data: { ...createStepData("end"), label: "Fim · Não chamou" },
      },
      {
        id: endNoClickId,
        type: "funnelStep",
        position: { x: 1120, y: 360 },
        data: { ...createStepData("end"), label: "Fim · Não clicou" },
      },
    ],
    edges: [
      { id: "e-start-aud", source: startId, target: audienceId },
      { id: "e-aud-disp", source: audienceId, target: disparoId },
      { id: "e-disp-fb", source: disparoId, target: feedbackId },
      {
        id: "e-fb-clicked",
        source: feedbackId,
        sourceHandle: "clicked",
        target: endClickedId,
        label: "Quem clicou",
      },
      {
        id: "e-fb-nochat",
        source: feedbackId,
        sourceHandle: "clicked_no_chat",
        target: endNoChatId,
        label: "Clicou e não chamou",
      },
      {
        id: "e-fb-noclick",
        source: feedbackId,
        sourceHandle: "not_clicked",
        target: endNoClickId,
        label: "Não clicou",
      },
    ],
  };
}
