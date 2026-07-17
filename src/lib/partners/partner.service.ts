import { hashPassword } from "@/lib/auth/password";
import { ALL_MENU_ITEM_IDS, type MenuItemId } from "@/lib/config/menu-items";
import { normalizeEmail } from "@/lib/auth/master-user";
import { isValidBrazilUf } from "@/lib/geo/brazil-ufs";
import { isCompleteCep } from "@/lib/masks/br-cep";
import { isCompletePhoneBr } from "@/lib/masks/br-phone";
import { isFilledValidEmail } from "@/lib/masks/email";
import { PARTNER_BANKS } from "@/lib/partners/partner.constants";
import {
  changePartnerStatus,
  findVisiblePartner,
  getPartnerAccess,
  insertPartner,
  listPartnerEvents,
  listPartnersForActor,
  partnerTaxIdExists,
  updatePartner,
} from "@/lib/partners/partner.repository";
import type {
  PartnerEventRecord,
  PartnerListQuery,
  PartnerListResult,
  PartnerPixKeyType,
  PartnerRecord,
  PartnerStatus,
  PartnerUpsertInput,
} from "@/lib/partners/partner.types";
import { findUserByEmail } from "@/lib/users/user.repository";

export type PartnerActor = {
  userId: string;
  name: string;
  isMaster: boolean;
  menuIds: MenuItemId[];
};

const CATEGORY_VALUES = new Set(["substabelecido", "gerente", "suporte", "atendente"]);
const PERSON_TYPE_VALUES = new Set(["pf", "pj"]);
const PIX_KEY_TYPE_VALUES = new Set(["cpf", "phone", "email", "random"]);
const VALID_MENU_IDS = new Set<MenuItemId>(ALL_MENU_ITEM_IDS);
const VALID_BANK_IDS = new Set<string>(PARTNER_BANKS.map((bank) => bank.id));

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || isRepeatedDigits(cpf)) return false;
  for (let size = 9; size <= 10; size += 1) {
    let sum = 0;
    for (let index = 0; index < size; index += 1) {
      sum += Number(cpf[index]) * (size + 1 - index);
    }
    const digit = ((sum * 10) % 11) % 10;
    if (digit !== Number(cpf[size])) return false;
  }
  return true;
}

function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || isRepeatedDigits(cnpj)) return false;
  const calculate = (length: number) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(cnpj[12]) && calculate(13) === Number(cnpj[13]);
}

function cleanText(value: string, maxLength: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function normalizeMenuIds(menuIds: MenuItemId[]): MenuItemId[] {
  return [...new Set(menuIds)].filter((id): id is MenuItemId => VALID_MENU_IDS.has(id));
}

function normalizePixKey(type: PartnerPixKeyType, raw: string): string {
  if (type === "cpf") return onlyDigits(raw).slice(0, 11);
  if (type === "phone") return onlyDigits(raw).slice(0, 11);
  if (type === "email") return normalizeEmail(raw);
  return cleanText(raw, 180);
}

function assertValidPixKey(type: PartnerPixKeyType, pixKey: string): void {
  if (type === "cpf") {
    if (!isValidCpf(pixKey)) throw new Error("Informe uma chave PIX de CPF válida.");
    return;
  }
  if (type === "phone") {
    if (!isCompletePhoneBr(pixKey)) throw new Error("Informe uma chave PIX de telefone válida.");
    return;
  }
  if (type === "email") {
    if (!isFilledValidEmail(pixKey)) throw new Error("Informe uma chave PIX de e-mail válida.");
    return;
  }
  if (pixKey.length < 8) throw new Error("Informe uma chave PIX aleatória válida.");
}

function validateGrantedMenus(actor: PartnerActor, menuIds: MenuItemId[]): void {
  if (actor.isMaster) return;
  const actorMenus = new Set(actor.menuIds);
  const forbidden = menuIds.find((menuId) => !actorMenus.has(menuId));
  if (forbidden) {
    throw new Error("Você não pode conceder um menu que não possui.");
  }
}

async function assertActorCanCreate(actor: PartnerActor): Promise<void> {
  if (actor.isMaster) return;
  const access = await getPartnerAccess(actor.userId);
  if (!access || access.status !== "active" || !access.can_create_partners) {
    throw new Error("Você não possui permissão para cadastrar parceiros.");
  }
}

function validateAndNormalizeInput(
  actor: PartnerActor,
  raw: PartnerUpsertInput,
  options: { creating: boolean },
): PartnerUpsertInput {
  if (!CATEGORY_VALUES.has(raw.category)) throw new Error("Selecione uma categoria válida.");
  if (!PERSON_TYPE_VALUES.has(raw.personType)) {
    throw new Error("Selecione Pessoa Física ou Jurídica.");
  }
  if (!PIX_KEY_TYPE_VALUES.has(raw.pixKeyType)) throw new Error("Selecione o tipo de chave PIX.");

  const name = cleanText(raw.name, 160);
  const email = normalizeEmail(raw.email);
  const taxId = onlyDigits(raw.taxId);
  const rg = cleanText(raw.rg, 30);
  const phone = onlyDigits(raw.phone).slice(0, 11);
  const whatsapp = onlyDigits(raw.whatsapp).slice(0, 11);
  const pixKey = normalizePixKey(raw.pixKeyType, raw.pixKey);
  const cep = onlyDigits(raw.cep).slice(0, 8);
  const street = cleanText(raw.street, 180);
  const neighborhood = cleanText(raw.neighborhood, 120);
  const city = cleanText(raw.city, 120);
  const state = cleanText(raw.state, 2).toUpperCase();
  const complement = cleanText(raw.complement, 120);
  const number = cleanText(raw.number, 30);
  const menuIds = normalizeMenuIds(raw.menuIds);
  const bankIds = [...new Set(raw.bankIds)].filter((id) => VALID_BANK_IDS.has(id));

  if (name.length < 3) throw new Error("Informe o nome completo ou razão social.");
  if (!isFilledValidEmail(email)) throw new Error("Informe um e-mail válido.");
  if (raw.personType === "pf" && !isValidCpf(taxId)) throw new Error("Informe um CPF válido.");
  if (raw.personType === "pj" && !isValidCnpj(taxId)) throw new Error("Informe um CNPJ válido.");
  if (raw.personType === "pf" && !rg) throw new Error("Informe o RG.");
  if (!isCompletePhoneBr(phone)) throw new Error("Informe um telefone válido com DDD.");
  if (!isCompletePhoneBr(whatsapp)) throw new Error("Informe um WhatsApp válido com DDD.");
  assertValidPixKey(raw.pixKeyType, pixKey);
  if (!isCompleteCep(cep)) throw new Error("Informe um CEP válido com 8 dígitos.");
  if (!street) throw new Error("Informe o endereço.");
  if (!number) throw new Error("Informe o número.");
  if (!neighborhood) throw new Error("Informe o bairro.");
  if (!city) throw new Error("Informe a cidade.");
  if (!isValidBrazilUf(state)) throw new Error("Selecione um estado (UF) válido.");
  if (bankIds.length === 0) throw new Error("Selecione ao menos um banco de atuação.");
  if (menuIds.length === 0) throw new Error("Selecione ao menos um menu de acesso.");
  if (options.creating && (!raw.password || raw.password.length < 8)) {
    throw new Error("A senha deve ter ao menos 8 caracteres.");
  }
  if (!options.creating && raw.password && raw.password.length < 8) {
    throw new Error("A nova senha deve ter ao menos 8 caracteres.");
  }
  if (!menuIds.includes("parceiros") && raw.canCreatePartners) {
    throw new Error("Para cadastrar filhos, o parceiro precisa ter acesso ao menu Parceiros.");
  }
  validateGrantedMenus(actor, menuIds);

  return {
    ...raw,
    name,
    email,
    taxId,
    rg: raw.personType === "pf" ? rg : "",
    phone,
    whatsapp,
    pixKey,
    cep,
    street,
    neighborhood,
    city,
    state,
    complement,
    number,
    menuIds,
    bankIds,
  };
}

async function assertUniqueEmail(email: string, exceptUserId?: string): Promise<void> {
  const existing = await findUserByEmail(email);
  if (existing && existing.id !== exceptUserId) {
    throw new Error("Já existe um usuário com este e-mail.");
  }
}

async function assertUniqueTaxId(taxId: string, exceptUserId?: string): Promise<void> {
  if (await partnerTaxIdExists(taxId, exceptUserId)) {
    throw new Error("Já existe um parceiro com este CPF/CNPJ.");
  }
}

export async function listPartners(
  actor: PartnerActor,
  query: PartnerListQuery,
): Promise<PartnerListResult> {
  return listPartnersForActor(actor.userId, actor.isMaster, query);
}

export async function createPartner(
  actor: PartnerActor,
  raw: PartnerUpsertInput,
): Promise<PartnerRecord> {
  await assertActorCanCreate(actor);
  const data = validateAndNormalizeInput(actor, raw, { creating: true });
  await Promise.all([assertUniqueEmail(data.email), assertUniqueTaxId(data.taxId)]);
  const { saltB64, hashB64 } = await hashPassword(data.password!);
  const userId = `partner-${crypto.randomUUID()}`;
  await insertPartner({
    userId,
    actorUserId: actor.userId,
    actorName: actor.name,
    passwordSaltB64: saltB64,
    passwordHashB64: hashB64,
    data,
  });
  const created = await findVisiblePartner(actor.userId, actor.isMaster, userId);
  if (!created) throw new Error("Parceiro criado, mas não foi possível recarregar o cadastro.");
  return created;
}

export async function editPartner(
  actor: PartnerActor,
  targetUserId: string,
  raw: PartnerUpsertInput,
): Promise<PartnerRecord> {
  const current = await findVisiblePartner(actor.userId, actor.isMaster, targetUserId);
  if (!current) throw new Error("Parceiro não encontrado ou fora da sua hierarquia.");
  const data = validateAndNormalizeInput(actor, raw, { creating: false });
  await Promise.all([
    assertUniqueEmail(data.email, targetUserId),
    assertUniqueTaxId(data.taxId, targetUserId),
  ]);

  let passwordSaltB64: string | undefined;
  let passwordHashB64: string | undefined;
  if (data.password) {
    const hashed = await hashPassword(data.password);
    passwordSaltB64 = hashed.saltB64;
    passwordHashB64 = hashed.hashB64;
  }

  await updatePartner({
    targetUserId,
    actorUserId: actor.userId,
    actorName: actor.name,
    passwordSaltB64,
    passwordHashB64,
    data,
  });
  const updated = await findVisiblePartner(actor.userId, actor.isMaster, targetUserId);
  if (!updated) throw new Error("Parceiro atualizado, mas não foi possível recarregar o cadastro.");
  return updated;
}

export async function setPartnerStatus(
  actor: PartnerActor,
  targetUserId: string,
  status: PartnerStatus,
  reason?: string,
): Promise<void> {
  const current = await findVisiblePartner(actor.userId, actor.isMaster, targetUserId);
  if (!current) throw new Error("Parceiro não encontrado ou fora da sua hierarquia.");
  if (status === "blocked" && cleanText(reason ?? "", 500).length < 3) {
    throw new Error("Informe o motivo do bloqueio.");
  }
  if (!["active", "inactive", "blocked"].includes(status)) throw new Error("Status inválido.");
  if (current.status === status) return;

  const action =
    status === "blocked"
      ? "blocked"
      : status === "inactive"
        ? "inactivated"
        : current.status === "blocked"
          ? "unblocked"
          : "activated";
  await changePartnerStatus({
    targetUserId,
    actorUserId: actor.userId,
    actorName: actor.name,
    status,
    reason: cleanText(reason ?? "", 500) || undefined,
    action,
  });
}

export async function getPartnerEvents(
  actor: PartnerActor,
  targetUserId: string,
): Promise<PartnerEventRecord[]> {
  const current = await findVisiblePartner(actor.userId, actor.isMaster, targetUserId);
  if (!current) throw new Error("Parceiro não encontrado ou fora da sua hierarquia.");
  return listPartnerEvents(targetUserId);
}
