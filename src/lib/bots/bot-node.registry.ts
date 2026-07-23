import type {
  BotExecutionKind,
  BotNodeCategory,
  BotNodeConfig,
  BotNodeData,
  BotNodeKind,
  BotPortDef,
} from "@/lib/bots/bot.types";

export type BotNodeDefinition = {
  kind: BotNodeKind;
  category: BotNodeCategory;
  executionKind: BotExecutionKind;
  label: string;
  description: string;
  inputs: BotPortDef[];
  outputs: BotPortDef[];
  defaultConfig: BotNodeConfig;
};

const IN: BotPortDef[] = [{ id: "in", label: "Entrada" }];
const OUT: BotPortDef[] = [{ id: "out", label: "Saída" }];
const NONE_IN: BotPortDef[] = [];
const NONE_OUT: BotPortDef[] = [];

function def(
  partial: Omit<BotNodeDefinition, "inputs" | "outputs" | "defaultConfig"> & {
    inputs?: BotPortDef[];
    outputs?: BotPortDef[];
    defaultConfig?: BotNodeConfig;
  },
): BotNodeDefinition {
  return {
    inputs: partial.inputs ?? IN,
    outputs: partial.outputs ?? OUT,
    defaultConfig: partial.defaultConfig ?? {},
    ...partial,
  };
}

/**
 * Catálogo modular — adicionar um node aqui registra UI + runtime sem tocar no núcleo.
 */
export const BOT_NODE_REGISTRY: BotNodeDefinition[] = [
  // ——— Chatbot ———
  def({
    kind: "start",
    category: "chatbot",
    executionKind: "flow",
    label: "Início",
    description: "Ponto de entrada do fluxo",
    inputs: NONE_IN,
    defaultConfig: { label: "Início" },
  }),
  def({
    kind: "end",
    category: "chatbot",
    executionKind: "flow",
    label: "Fim",
    description: "Encerra o atendimento neste ramo",
    outputs: NONE_OUT,
    defaultConfig: { label: "Fim" },
  }),
  def({
    kind: "wait_reply",
    category: "chatbot",
    executionKind: "flow",
    label: "Esperar resposta",
    description: "Aguarda mensagem do contato",
    defaultConfig: {
      timeoutSeconds: 300,
      outputVariable: "ultima_resposta",
    },
  }),
  def({
    kind: "delay",
    category: "chatbot",
    executionKind: "flow",
    label: "Delay",
    description: "Aguarda um intervalo antes de seguir",
    defaultConfig: { delaySeconds: 3 },
  }),
  def({
    kind: "condition",
    category: "chatbot",
    executionKind: "flow",
    label: "Condição",
    description: "Bifurca em verdadeiro / falso",
    outputs: [
      { id: "true", label: "Sim" },
      { id: "false", label: "Não" },
    ],
    defaultConfig: { expression: "{{ultima_resposta}} contém sim" },
  }),
  def({
    kind: "switch",
    category: "chatbot",
    executionKind: "flow",
    label: "Switch",
    description: "Múltiplos caminhos por valor",
    outputs: [
      { id: "case-1", label: "Caso 1" },
      { id: "case-2", label: "Caso 2" },
      { id: "default", label: "Padrão" },
    ],
    defaultConfig: {
      expression: "{{ultima_resposta}}",
      cases: [
        { id: "case-1", label: "Caso 1", value: "1" },
        { id: "case-2", label: "Caso 2", value: "2" },
      ],
    },
  }),
  def({
    kind: "loop",
    category: "chatbot",
    executionKind: "flow",
    label: "Loop",
    description: "Repete um trecho até limite",
    outputs: [
      { id: "body", label: "Corpo" },
      { id: "done", label: "Concluído" },
    ],
    defaultConfig: { maxIterations: 3, outputVariable: "loop_index" },
  }),
  def({
    kind: "message",
    category: "chatbot",
    executionKind: "flow",
    label: "Mensagem",
    description: "Envia texto ao contato",
    defaultConfig: { text: "Olá! Como posso ajudar?" },
  }),
  def({
    kind: "buttons",
    category: "chatbot",
    executionKind: "flow",
    label: "Botões",
    description: "Mensagem com botões de escolha",
    outputs: [
      { id: "opt-1", label: "Opção 1" },
      { id: "opt-2", label: "Opção 2" },
      { id: "out", label: "Fallback" },
    ],
    defaultConfig: {
      text: "Escolha uma opção:",
      options: [{ id: "opt-1", label: "", value: "" }],
    },
  }),
  def({
    kind: "list",
    category: "chatbot",
    executionKind: "flow",
    label: "Lista",
    description: "Lista interativa de opções",
    defaultConfig: {
      text: "Selecione na lista:",
      options: [
        { id: "opt-1", label: "Opção A", value: "a" },
        { id: "opt-2", label: "Opção B", value: "b" },
      ],
    },
  }),
  def({
    kind: "menu",
    category: "chatbot",
    executionKind: "flow",
    label: "Menu",
    description: "Menu numerado de atendimento",
    defaultConfig: {
      text: "Digite o número da opção:",
      options: [
        { id: "opt-1", label: "1 - Atendimento", value: "1" },
        { id: "opt-2", label: "2 - Financeiro", value: "2" },
      ],
    },
  }),
  def({
    kind: "image",
    category: "chatbot",
    executionKind: "flow",
    label: "Imagem",
    description: "Envia imagem",
    defaultConfig: { mediaUrl: "", mediaCaption: "" },
  }),
  def({
    kind: "pdf",
    category: "chatbot",
    executionKind: "flow",
    label: "PDF",
    description: "Envia documento PDF",
    defaultConfig: { mediaUrl: "", mediaCaption: "" },
  }),
  def({
    kind: "audio",
    category: "chatbot",
    executionKind: "flow",
    label: "Áudio",
    description: "Envia áudio",
    defaultConfig: { mediaUrl: "" },
  }),
  def({
    kind: "video",
    category: "chatbot",
    executionKind: "flow",
    label: "Vídeo",
    description: "Envia vídeo",
    defaultConfig: { mediaUrl: "", mediaCaption: "" },
  }),
  def({
    kind: "expediente",
    category: "chatbot",
    executionKind: "flow",
    label: "Expediente",
    description: "Bifurca por turno (Brasília): Bom dia / Boa tarde / Boa noite",
    outputs: [
      { id: "bom_dia", label: "Bom dia" },
      { id: "boa_tarde", label: "Boa tarde" },
      { id: "boa_noite", label: "Boa noite" },
    ],
    defaultConfig: {
      label: "Expediente",
      outputVariable: "turno",
    },
  }),

  // ——— IA ———
  def({
    kind: "calc_margin",
    category: "ia",
    executionKind: "llm",
    label: "Calcular Margem",
    description: "IA calcula margem conforme parâmetros",
    defaultConfig: {
      prompt: "Calcule a margem disponível com base nos parâmetros.",
      outputVariable: "margem_calculada",
      marginParams: {
        salarioBrutoVar: "salario_bruto",
        descontosVar: "descontos",
        percentualVar: "percentual_margem",
      },
    },
  }),
  def({
    kind: "map_data",
    category: "ia",
    executionKind: "llm",
    label: "Mapear dados",
    description: "OCR + LLM extrai campos de PDF/imagem",
    defaultConfig: {
      mapFields: [
        "nome",
        "cpf",
        "data_nascimento",
        "cargo",
        "situacao_funcional",
        "tipo_cargo",
        "vinculo",
        "matricula",
        "margem_disponivel",
      ],
      outputVariable: "dados_mapeados",
    },
  }),
  def({
    kind: "prompt",
    category: "ia",
    executionKind: "llm",
    label: "Prompt",
    description: "Chamada livre à LLM",
    defaultConfig: {
      prompt: "Responda de forma objetiva e cordial.",
      outputVariable: "resposta_ia",
      model: "gpt-4o-mini",
    },
  }),
  def({
    kind: "saudacao",
    category: "ia",
    executionKind: "llm",
    label: "Saudação",
    description: "IA gera saudação inicial com turno (Brasília) + texto institucional",
    defaultConfig: {
      prompt:
        "Faça uma saudação inicial curta e cordial em português do Brasil. Use o turno informado (Bom dia / Boa tarde / Boa noite) e incorpore o texto institucional. Não invente dados do cliente. Uma ou duas frases no máximo.",
      institutionalText: "Somos a Soma Promotora. Estamos aqui para ajudar.",
      outputVariable: "saudacao",
      model: "gpt-4o-mini",
    },
  }),
  def({
    kind: "confirm_data",
    category: "ia",
    executionKind: "llm",
    label: "Confirmar dados",
    description: "Apresenta dados extraídos e pede confirmação",
    outputs: [
      { id: "confirmed", label: "Confirmado" },
      { id: "rejected", label: "Corrigir" },
    ],
    defaultConfig: {
      text: "Confirme se os dados abaixo estão corretos:",
      confirmFields: ["nome", "cpf", "margem_disponivel"],
      outputVariable: "dados_confirmados",
    },
  }),

  // ——— Sistema ———
  def({
    kind: "create_lead",
    category: "sistema",
    executionKind: "system",
    label: "Criar Lead",
    description: "Cria lead/cliente no CRM",
    defaultConfig: {
      leadFields: { nome: "{{dados_mapeados.nome}}", cpf: "{{dados_mapeados.cpf}}" },
      outputVariable: "lead_id",
    },
  }),
  def({
    kind: "update_lead",
    category: "sistema",
    executionKind: "system",
    label: "Atualizar Lead",
    description: "Atualiza campos do lead",
    defaultConfig: {
      leadFields: { margem_disponivel: "{{dados_mapeados.margem_disponivel}}" },
    },
  }),
  def({
    kind: "add_tags",
    category: "sistema",
    executionKind: "system",
    label: "Adicionar tags",
    description: "Aplica tags ao contato/lead",
    defaultConfig: { tags: ["bot", "atendimento"] },
  }),
  def({
    kind: "add_status",
    category: "sistema",
    executionKind: "system",
    label: "Adicionar Status",
    description: "Define status de atendimento",
    defaultConfig: { statusId: "" },
  }),
  def({
    kind: "transfer_agent",
    category: "sistema",
    executionKind: "system",
    label: "Transferir Atendente",
    description: "Transfere para um humano",
    defaultConfig: { attendantUserId: "" },
  }),
];

export function getBotNodeDefinition(kind: BotNodeKind): BotNodeDefinition | undefined {
  return BOT_NODE_REGISTRY.find((item) => item.kind === kind);
}

export function listBotNodesByCategory(category: BotNodeCategory): BotNodeDefinition[] {
  return BOT_NODE_REGISTRY.filter((item) => item.category === category);
}

export function createBotNodeData(kind: BotNodeKind): BotNodeData {
  const definition = getBotNodeDefinition(kind);
  if (!definition) {
    throw new Error(`Node desconhecido: ${kind}`);
  }
  return {
    kind: definition.kind,
    category: definition.category,
    executionKind: definition.executionKind,
    title: definition.label,
    config: structuredClone(definition.defaultConfig),
    variables: {},
    logs: [],
    status: "idle",
    lastTestAt: null,
    lastTestResult: null,
  };
}

/** Saídas efetivas do node (Botões/Lista/Menu usam `config.options`). */
export function resolveBotNodeOutputs(data: Pick<BotNodeData, "kind" | "config">): BotPortDef[] {
  const definition = getBotNodeDefinition(data.kind);
  if (data.kind === "buttons" || data.kind === "list" || data.kind === "menu") {
    const options = (data.config.options || [])
      .filter((opt) => String(opt.label || "").trim().length > 0)
      .map((opt, index) => ({
        id: String(opt.id || `opt-${index + 1}`),
        label: String(opt.label).trim(),
      }));
    if (options.length === 0) {
      return data.kind === "buttons"
        ? [{ id: "out", label: "Fallback" }]
        : [{ id: "out", label: "Saída" }];
    }
    if (data.kind === "buttons") {
      return [...options, { id: "out", label: "Fallback" }];
    }
    return options;
  }
  return definition?.outputs?.length ? definition.outputs : [{ id: "out", label: "Saída" }];
}

export const BOT_CATEGORY_META: Record<
  BotNodeCategory,
  { label: string; accent: string; ring: string }
> = {
  chatbot: {
    label: "Chatbot",
    accent: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    ring: "border-sky-500/40",
  },
  ia: {
    label: "IA · OpenAI",
    accent: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    ring: "border-violet-500/40",
  },
  sistema: {
    label: "Sistema",
    accent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    ring: "border-emerald-500/40",
  },
};
