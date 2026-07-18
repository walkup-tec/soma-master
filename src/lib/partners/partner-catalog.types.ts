/**
 * Domínio de parametrização Parceiros: bancos visíveis, produtos parceiro-only,
 * tabelas de comissão (flat/repasse/faixa) e solicitações de acesso.
 */
export type PartnerCommissionTable = {
  id: string;
  name: string;
  productId: string;
  bankId: string;
  productName: string;
  bankName: string;
  isDefault: boolean;
  partnerCategory: string | null;
  partnerUserIds: string[];
  fixedValueEnabled: boolean;
  fixedValueCents: number | null;
  flatPercent: number;
  repassePercent: number;
  flatCents: number | null;
  repasseCents: number | null;
  rangeMinCents: number;
  rangeMaxCents: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type PartnerCommissionTableInput = {
  id?: string;
  name: string;
  productId: string;
  bankId: string;
  isDefault: boolean;
  partnerCategory?: string | null;
  partnerUserIds?: string[];
  fixedValueEnabled: boolean;
  fixedValueCents?: number | null;
  flatPercent: number;
  repassePercent: number;
  rangeMinCents: number;
  rangeMaxCents: number;
};

export type PartnerProductBankRow = {
  key: string;
  productId: string;
  productName: string;
  bankId: string;
  bankName: string;
  partnerOnly: boolean;
  tableNames: string[];
};

export type PartnerVisibleBankRow = {
  id: string;
  name: string;
  visible: boolean;
};
