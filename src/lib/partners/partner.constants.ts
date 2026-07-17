import type {
  PartnerCategory,
  PartnerPersonType,
  PartnerPixKeyType,
  PartnerStatus,
} from "@/lib/partners/partner.types";

export const PARTNER_CATEGORIES: Array<{ value: PartnerCategory; label: string }> = [
  { value: "substabelecido", label: "Substabelecido" },
  { value: "gerente", label: "Gerente" },
  { value: "suporte", label: "Suporte" },
  { value: "corban", label: "Corban" },
  { value: "atendente", label: "Atendente" },
];

/**
 * IDs em `crm.user_categories` usados só para FK de usuários-parceiro.
 * Não aparecem em Configurações → Categorias de usuário.
 */
export function partnerCategoryUserCategoryId(category: PartnerCategory): string {
  return `partner-cat-${category}`;
}

/** Categorias legadas que foram seedadas por engano como categorias de usuário. */
export const LEGACY_PARTNER_ONLY_CATEGORY_IDS = [
  "cat-substabelecido",
  "cat-suporte",
  "cat-corban",
] as const;

/** True se o id não deve aparecer na lista de categorias de usuário do admin. */
export function isPartnerLinkedUserCategoryId(id: string): boolean {
  if (id.startsWith("partner-cat-")) return true;
  return (LEGACY_PARTNER_ONLY_CATEGORY_IDS as readonly string[]).includes(id);
}

export const PARTNER_CATEGORY_ALIASES: Record<PartnerCategory, string> = {
  substabelecido: "SB",
  gerente: "GE",
  suporte: "SE",
  corban: "CN",
  atendente: "AE",
};

export const PARTNER_PERSON_TYPES: Array<{ value: PartnerPersonType; label: string }> = [
  { value: "pf", label: "Pessoa Física" },
  { value: "pj", label: "Pessoa Jurídica" },
];

export const PARTNER_PIX_KEY_TYPES: Array<{ value: PartnerPixKeyType; label: string }> = [
  { value: "cpf", label: "CPF" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Aleatória" },
];

export const PARTNER_STATUSES: Array<{ value: PartnerStatus; label: string }> = [
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
  { value: "blocked", label: "Bloqueados" },
];

export const PARTNER_BANKS = [
  { id: "banco-v8", name: "Banco V8" },
  { id: "presenca-bank", name: "Presença Bank" },
  { id: "peg-card", name: "Peg Card" },
  { id: "fy-digital", name: "FY Digital" },
  { id: "amigoz", name: "Amigoz" },
  { id: "aki-capital", name: "AKI Capital" },
] as const;

export function partnerCategoryLabel(value: PartnerCategory): string {
  return PARTNER_CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

export function partnerCategoryAlias(value: PartnerCategory): string {
  return PARTNER_CATEGORY_ALIASES[value];
}

export function partnerStatusLabel(value: PartnerStatus): string {
  return PARTNER_STATUSES.find((item) => item.value === value)?.label ?? value;
}
