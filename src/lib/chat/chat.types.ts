/** Tipos do módulo Chat WhatsApp (Soma). */

export type ChatSenderType = "contact" | "agent" | "ai" | "system";
export type ChatMessageDirection = "inbound" | "outbound";

export type ChatConversation = {
  id: string;
  phone: string;
  contactName: string | null;
  clientId: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  /** IA local da conversa — false quando atendente entra. */
  aiEnabled: boolean;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  /** Campos enriquecidos (opcional). */
  clientName?: string | null;
  clientStatusId?: string | null;
  clientStatusLabel?: string | null;
  clientStatusColor?: string | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  direction: ChatMessageDirection;
  body: string;
  senderType: ChatSenderType;
  senderUserId: string | null;
  senderName: string | null;
  waMessageId: string | null;
  createdAt: string;
};

export type ChatAiKnowledgeItem = {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type ChatAiExample = {
  id: string;
  userSays: string;
  assistantReplies: string;
  enabled: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type ChatAiSettings = {
  /**
   * Estado do último comando geral. O comando aplica o valor a todas as conversas,
   * mas cada conversa pode ser sobrescrita depois pelo seu próprio aiEnabled.
   */
  aiGlobalEnabled: boolean;
  openaiModel: string;
  systemPrompt: string;
  /**
   * URL pública HTTPS do CRM (sem path) para a Evolution entregar webhooks.
   * Localhost não funciona — use túnel ou domínio publicado.
   */
  webhookPublicBaseUrl: string;
  updatedAt: string;
};

export const DEFAULT_CHAT_AI_SETTINGS: ChatAiSettings = {
  aiGlobalEnabled: false,
  openaiModel: "gpt-4o-mini",
  systemPrompt: `Você é o assistente virtual da Soma Promotora no WhatsApp.
Atenda com clareza, cordialidade e objetividade.
Não invente dados de crédito, taxas ou contratos.
Se não souber algo ou o cliente pedir atendimento humano, diga que um atendente vai continuar a conversa.
Respostas curtas, em português do Brasil.`,
  webhookPublicBaseUrl: "",
  updatedAt: new Date(0).toISOString(),
};
