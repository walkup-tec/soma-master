import type { ClientFieldId, ClientFieldGroupId } from "@/lib/config/client-fields";
import type { MenuItemId } from "@/lib/config/menu-items";

export type UserCategory = {
  id: string;
  name: string;
  menuIds: MenuItemId[];
  /** Primeira tela após o login — deve estar em `menuIds`. */
  homeMenuId: MenuItemId;
};

/** Campo extra criado pelo master em Dados do produto (`custom-…`). */
export type ProductCustomField = {
  id: `custom-${string}`;
  label: string;
  /** Grupo do wizard: pessoais | profissionais | financeiros */
  groupId: ClientFieldGroupId;
};

export type ProductOperationalGuide = {
  displayName: string;
  fileName: string;
  storageId: string;
};

export type ProductConfig = {
  id: string;
  name: string;
  /** Espelha o nome (persistência); a UI usa só o nome como texto da tag. */
  tag: string;
  /** Hex #rrggbb — cor da tag (mesmo padrão dos status). */
  color: string;
  /** Bancos (Configurações → Bancos) vinculados a este produto. */
  bankIds: string[];
  /** Disponibilizar produto no fluxo de parceiros. */
  availableForPartners: boolean;
  /** Criado em Parceiros → Produtos: só aparece para parceiros, não em Produção própria. */
  partnerOnly: boolean;
  /** Campos builtin + custom disponíveis (opcionais). */
  availableFieldIds: ClientFieldId[];
  /** Campos builtin + custom obrigatórios. */
  requiredFieldIds: ClientFieldId[];
  /** Metadados dos campos dinâmicos (label/grupo). */
  customFields: ProductCustomField[];
  operationalGuideEnabled: boolean;
  operationalGuide: ProductOperationalGuide | null;
};

/** @deprecated Roteiro passou para ProductConfig — mantido só para leitura legada de bancos. */
export type BankOperationalGuide = ProductOperationalGuide;

export type BankConfig = {
  id: string;
  name: string;
  stormAccessEnabled: boolean;
  stormUsername: string;
  stormPassword: string;
  stormLink: string;
  bankAccessEnabled: boolean;
  bankUsername: string;
  bankPassword: string;
  bankLink: string;
  /** Legado: roteiro agora é do produto. */
  operationalGuideEnabled: boolean;
  operationalGuide: BankOperationalGuide | null;
};

export type AttendanceStatusConfig = {
  id: string;
  label: string;
  /** Hex #rrggbb — cor da tag na listagem de clientes. */
  color: string;
  /**
   * Dias até o retorno automático na Agenda (null/0 = desligado).
   * Ao aplicar o status, agenda contato para o usuário que atribuiu.
   */
  autoReturnDays: number | null;
};

/** Tag do chatbot — pode transferir o cliente para um fluxo de Bot. */
export type ChatTagConfig = {
  id: string;
  label: string;
  color: string;
  /**
   * ID do bot (fluxo) para o qual o cliente é ingressado
   * quando esta tag for aplicada. null = só marca, sem transferir.
   */
  transferBotId: string | null;
};

export type WeekdayId = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** Um turno contínuo dentro do dia (HH:mm). */
export type ChatbotTimeShift = {
  /** HH:mm */
  start: string;
  /** HH:mm */
  end: string;
};

export type ChatbotDaySchedule = {
  enabled: boolean;
  /** Turnos do dia — ex.: 09:00–12:00 e 13:00–20:00. */
  shifts: ChatbotTimeShift[];
};

/** Bots de atendimento por janela de expediente + grade horária. */
export type ChatbotRuntimeConfig = {
  /** Bot ativo dentro do horário de expediente. */
  expedienteBotId: string | null;
  /** Bot ativo fora do horário de expediente. */
  foraExpedienteBotId: string | null;
  /** Se true, ignora dias/horários — usa só o Bot expediente 24h. */
  alwaysOpen: boolean;
  schedule: Record<WeekdayId, ChatbotDaySchedule>;
};

export type SystemSettings = {
  categories: UserCategory[];
  products: ProductConfig[];
  banks: BankConfig[];
  attendanceStatuses: AttendanceStatusConfig[];
  chatTags: ChatTagConfig[];
  chatbotRuntime: ChatbotRuntimeConfig;
};
