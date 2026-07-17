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
  /** Texto curto da tag na listagem (ex.: CLT). Se vazio, usa o nome. */
  tag: string;
  /** Hex #rrggbb — cor da tag (mesmo padrão dos status). */
  color: string;
  availableFieldIds: ClientFieldId[];
  requiredFieldIds: ClientFieldId[];
};

export type BankConfig = {
  id: string;
  name: string;
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

export type SystemSettings = {
  categories: UserCategory[];
  products: ProductConfig[];
  banks: BankConfig[];
  attendanceStatuses: AttendanceStatusConfig[];
};
