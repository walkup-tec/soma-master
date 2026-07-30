/**
 * Construtor de fluxos híbridos (Chatbot + IA + Sistema).
 * Núcleo tipado — novos nodes entram no registry sem alterar o runtime.
 */

export type BotNodeCategory = "chatbot" | "ia" | "sistema";

/** Quem executa o node no motor híbrido. */
export type BotExecutionKind = "flow" | "llm" | "system";

export type BotNodeKind =
  // Chatbot
  | "start"
  | "end"
  | "wait_reply"
  | "delay"
  | "condition"
  | "switch"
  | "loop"
  | "message"
  | "buttons"
  | "list"
  | "menu"
  | "image"
  | "pdf"
  | "audio"
  | "video"
  | "expediente"
  // IA
  | "calc_margin"
  | "map_data"
  | "prompt"
  | "saudacao"
  | "confirm_data"
  // Sistema
  | "create_lead"
  | "update_lead"
  | "add_tags"
  | "add_status"
  | "transfer_agent";

export type BotPortDef = {
  id: string;
  label: string;
};

export type BotNodeStatus =
  | "idle"
  | "ready"
  | "running"
  | "waiting"
  | "success"
  | "error"
  | "skipped";

/** Valores serializáveis no motor / server fns. */
export type BotJson =
  | string
  | number
  | boolean
  | null
  | BotJson[]
  | { [key: string]: BotJson };

export type BotNodeLogEntry = {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
  data?: Record<string, BotJson>;
};

/** Campos extraíveis no Mapear dados (produto + extras de holerite/contracheque). */
export type BotTransferMode = "random" | "round_robin" | "specific";

export type BotMapFieldId =
  | "nome"
  | "cpf"
  | "data_nascimento"
  | "cargo"
  | "situacao_funcional"
  | "tipo_cargo"
  | "vinculo"
  | "matricula"
  | "margem_disponivel";

export const BOT_MAP_FIELD_OPTIONS: Array<{ id: BotMapFieldId; label: string }> = [
  { id: "nome", label: "Nome" },
  { id: "cpf", label: "CPF" },
  { id: "data_nascimento", label: "Data de Nascimento" },
  { id: "cargo", label: "Cargo" },
  { id: "situacao_funcional", label: "Situação Funcional" },
  { id: "tipo_cargo", label: "Tipo de Cargo" },
  { id: "vinculo", label: "Vínculo" },
  { id: "matricula", label: "Matrícula" },
  { id: "margem_disponivel", label: "Margem Disponível" },
];

export type BotNodeConfig = {
  label?: string;
  description?: string;
  // message / media
  text?: string;
  mediaUrl?: string;
  mediaCaption?: string;
  // wait / delay
  timeoutSeconds?: number;
  delaySeconds?: number;
  // condition / switch
  expression?: string;
  cases?: Array<{ id: string; label: string; value: string }>;
  // loop
  maxIterations?: number;
  // buttons / list / menu
  options?: Array<{ id: string; label: string; value?: string }>;
  // IA
  prompt?: string;
  /** Texto institucional usado na Saudação (IA). */
  institutionalText?: string;
  model?: string;
  productId?: string;
  mapFields?: BotMapFieldId[];
  confirmFields?: string[];
  marginParams?: {
    salarioBrutoVar?: string;
    descontosVar?: string;
    percentualVar?: string;
  };
  // sistema
  tags?: string[];
  statusId?: string;
  /**
   * Transferir Atendente:
   * - random: entre atendentes online (logados no CRM)
   * - round_robin: 1 para 1 na fila de cadastrados
   * - specific: atendente fixo (fica na fila dele se offline)
   */
  transferMode?: BotTransferMode;
  attendantUserId?: string;
  /** Mapeamento campo → expressão/variável (ex.: nome → {{ultima_resposta}}). */
  leadFields?: Record<string, string>;
  /**
   * Atualizar Lead — UI:
   * variável de origem (saída do node anterior), escopo obrigatório/opcional e campo alvo.
   */
  sourceVariable?: string;
  leadFieldScopeRequired?: boolean;
  leadFieldScopeOptional?: boolean;
  targetFieldId?: string;
  // variáveis locais do node
  outputVariable?: string;
};

export type BotNodeData = {
  kind: BotNodeKind;
  category: BotNodeCategory;
  executionKind: BotExecutionKind;
  title: string;
  config: BotNodeConfig;
  variables: Record<string, BotJson>;
  logs: BotNodeLogEntry[];
  status: BotNodeStatus;
  lastTestAt?: string | null;
  lastTestResult?: string | null;
};

export type BotFlowNode = {
  id: string;
  type: "botStep";
  position: { x: number; y: number };
  deletable?: boolean;
  data: BotNodeData;
};

export type BotFlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
};

export type BotFlowDraft = {
  id: string;
  name: string;
  updatedAt: string;
  nodes: BotFlowNode[];
  edges: BotFlowEdge[];
};

export type BotRunPhase =
  | "idle"
  | "starting"
  | "running"
  | "waiting_reply"
  | "finished"
  | "error";

export type BotRunState = {
  id: string;
  flowId: string;
  flowName: string;
  testPhone: string;
  phase: BotRunPhase;
  currentNodeId: string | null;
  variables: Record<string, BotJson>;
  logs: BotNodeLogEntry[];
  startedAt: string;
  updatedAt: string;
  error?: string;
};

export type BotNodeExecuteContext = {
  node: BotFlowNode;
  variables: Record<string, BotJson>;
  testPhone?: string;
  dryRun?: boolean;
  /** Resposta do contato neste tick (botões / wait_reply). */
  inboundText?: string | null;
  /** Conversa WhatsApp (persistência de Atualizar Lead). */
  conversationId?: string;
  phone?: string;
};

export type BotNodeExecuteResult = {
  ok: boolean;
  status: BotNodeStatus;
  message: string;
  /** Handle de saída a seguir (ex.: "out", "true", "case-1"). */
  nextHandle?: string;
  variables?: Record<string, BotJson>;
  outboundText?: string;
  waitForReply?: boolean;
  data?: Record<string, BotJson>;
};
