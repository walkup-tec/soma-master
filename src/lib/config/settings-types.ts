import type { ClientFieldId } from "@/lib/config/client-fields";
import type { MenuItemId } from "@/lib/config/menu-items";

export type UserCategory = {
  id: string;
  name: string;
  menuIds: MenuItemId[];
  /** Primeira tela após o login — deve estar em `menuIds`. */
  homeMenuId: MenuItemId;
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
  availableFieldIds: ClientFieldId[];
  requiredFieldIds: ClientFieldId[];
};

export type BankOperationalGuide = {
  displayName: string;
  fileName: string;
  storageId: string;
};

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

export type ChatbotDaySchedule = {
  enabled: boolean;
  /** HH:mm */
  start: string;
  /** HH:mm */
  end: string;
};

/** Bot que atende leads novos + janela de expediente. */
export type ChatbotRuntimeConfig = {
  activeBotId: string | null;
  /** Se true, ignora dias/horários — bot sempre disponível. */
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
