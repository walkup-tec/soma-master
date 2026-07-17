import type { MenuItemId } from "@/lib/config/menu-items";

export type PartnerCategory = "substabelecido" | "gerente" | "suporte" | "corban" | "atendente";
export type PartnerPersonType = "pf" | "pj";
export type PartnerStatus = "active" | "inactive" | "blocked";
export type PartnerPixKeyType = "cpf" | "phone" | "email" | "random";
export type PartnerProductionFilter = "all" | "with" | "without";

export type PartnerRecord = {
  id: string;
  parentUserId: string | null;
  parentName: string | null;
  name: string;
  category: PartnerCategory;
  personType: PartnerPersonType;
  taxId: string;
  rg: string;
  email: string;
  phone: string;
  whatsapp: string;
  pixKeyType: PartnerPixKeyType;
  pixKey: string;
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
  number: string;
  status: PartnerStatus;
  blockedReason: string | null;
  /** true quando já existe evento de bloqueio no histórico. */
  hasBlockHistory: boolean;
  canCreatePartners: boolean;
  hasProduction: boolean;
  menuIds: MenuItemId[];
  bankIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type PartnerListQuery = {
  status: PartnerStatus;
  search: string;
  production: PartnerProductionFilter;
  bankIds: string[];
  page: number;
  pageSize: number;
};

export type PartnerListResult = {
  items: PartnerRecord[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<PartnerStatus, number>;
  canCreatePartners: boolean;
  allowedMenuIds: MenuItemId[];
};

export type PartnerUpsertInput = {
  category: PartnerCategory;
  personType: PartnerPersonType;
  name: string;
  taxId: string;
  rg: string;
  email: string;
  password?: string;
  phone: string;
  whatsapp: string;
  pixKeyType: PartnerPixKeyType;
  pixKey: string;
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
  number: string;
  menuIds: MenuItemId[];
  canCreatePartners: boolean;
  bankIds: string[];
};

export type PartnerSaveResult = {
  partner: PartnerRecord;
  /** Código temporário exibido uma única vez após criação/troca de senha. */
  accessCode: string | null;
};

export type PartnerEventAction =
  | "created"
  | "updated"
  | "activated"
  | "inactivated"
  | "blocked"
  | "unblocked";

export type PartnerEventRecord = {
  id: string;
  action: PartnerEventAction;
  actorName: string;
  reason: string | null;
  createdAt: string;
};
