import type { ClientFieldId } from "@/lib/config/client-fields";

export type ClientDisplayMode = "kanban" | "table" | "list";

export type LeadDistribution =
  | { type: "all" }
  | { type: "category"; categoryIds: string[] }
  | { type: "users"; userIds: string[] };

export type ClientImportDisplay = {
  mode: ClientDisplayMode;
  visibleFieldIds: ClientFieldId[];
};

export type ClientRecord = {
  id: string;
  productId: string;
  importBatchId: string;
  data: Partial<Record<ClientFieldId, string>>;
  assignedUserIds: string[];
  distribution: LeadDistribution;
  display: ClientImportDisplay;
  status: string;
  createdAt: string;
};

export type ImportClientsPayload = {
  productId: string;
  columnMapping: Partial<Record<ClientFieldId, string>>;
  rows: Record<string, string>[];
  distribution: LeadDistribution;
  display: ClientImportDisplay;
  /** Reutilizado em importação em lotes para manter o mesmo batch. */
  batchId?: string;
  /** YYYY-MM-DD — agenda contato para todos os leads importados neste lote. */
  scheduleContactDate?: string;
  scheduleUserId?: string;
  scheduleUserName?: string;
};

/** Exibição persistida no cliente + metadados opcionais só no job de importação. */
export type ImportJobDisplay = ClientImportDisplay & {
  scheduleContactDate?: string;
  scheduleUserId?: string;
  scheduleUserName?: string;
};

export function toClientImportDisplay(display: ImportJobDisplay | ClientImportDisplay): ClientImportDisplay {
  return {
    mode: display.mode,
    visibleFieldIds: display.visibleFieldIds,
  };
}

export type CreateManualClientPayload = {
  productId: string;
  data: Partial<Record<ClientFieldId, string>>;
  distribution: LeadDistribution;
  /** YYYY-MM-DD — agenda contato na criação manual. */
  scheduleContactDate?: string;
  scheduleUserId?: string;
  scheduleUserName?: string;
};

export type ClientAttendanceFilter = "all" | "with" | "without";

export type ClientScheduleFilter = "all" | "with";

export type ClientsPageQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  /** Multi-seleção de produtos (prioritário). */
  productIds?: string[];
  /** @deprecated Preferir `productIds`. */
  productId?: string;
  /** Multi-seleção de status de atendimento (prioritário). */
  statuses?: string[];
  /** @deprecated Preferir `statuses`. */
  status?: string;
  attendance?: ClientAttendanceFilter;
  schedule?: ClientScheduleFilter;
  /** YYYY-MM-DD — início do período de created_at (America/Sao_Paulo). */
  createdFrom?: string;
  /** YYYY-MM-DD — fim do período de created_at (America/Sao_Paulo). */
  createdTo?: string;
};

export type ClientBulkFilters = {
  search?: string;
  productIds?: string[];
  productId?: string;
  statuses?: string[];
  status?: string;
  attendance?: ClientAttendanceFilter;
  schedule?: ClientScheduleFilter;
  createdFrom?: string;
  createdTo?: string;
};

export type ClientBulkScope =
  | { mode: "ids"; clientIds: string[] }
  | { mode: "filter"; filters: ClientBulkFilters };

export type ClientActivityFlags = {
  hasSchedule: boolean;
  hasAttendance: boolean;
  hasAttachments: boolean;
};

export type ClientListItem = ClientActivityFlags & {
  id: string;
  productId: string;
  /** Produtos vinculados (primary + extras via client_products). */
  productIds: string[];
  status: string;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  distributionType: LeadDistribution["type"];
  distributionLabel: string;
  displayMode: ClientDisplayMode;
  displayFieldCount: number;
  createdAt: string;
};

export type ClientScheduleRecord = {
  id: string;
  clientId: string;
  userId: string;
  userName: string;
  contactDate: string;
  createdAt: string;
  updatedAt: string;
};

export type AgendaFilter = "today" | "tomorrow" | "all" | "overdue";

export type AgendaListQuery = {
  filter?: AgendaFilter;
  /** Apenas agendamentos ainda não concluídos (status ≠ concluído). */
  pendingOnly?: boolean;
};

/** Filtros do menu Remarketing (data de contato / agenda). */
export type RemarketingFilter = "today" | "week" | "next15" | "next30";

export type RemarketingListQuery = {
  filter?: RemarketingFilter;
};

export type RemarketingListItem = ClientListItem & {
  contactDate: string;
};

/** Modos do quadro Kanban. */
export type KanbanViewMode = "status" | "weekly" | "monthly";

export type KanbanListItem = ClientListItem & {
  /** Data de contato da agenda, se existir (YYYY-MM-DD). */
  contactDate: string | null;
};

export type AgendaAlertCounts = {
  todayPending: number;
  overduePending: number;
};

export type AgendaItem = {
  scheduleId: string;
  clientId: string;
  contactDate: string;
  scheduledBy: string;
  updatedAt: string;
  productId: string;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  whatsapp: string | null;
};

export type ClientsPageResult = {
  items: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ClientAttendanceRecord = {
  id: string;
  clientId: string;
  userId: string;
  userName: string;
  note: string;
  createdAt: string;
};

export type ClientAttachmentRecord = {
  id: string;
  clientId: string;
  userId: string;
  userName: string;
  fileName: string;
  fileSize: number;
  mimeType: string | null;
  createdAt: string;
};
