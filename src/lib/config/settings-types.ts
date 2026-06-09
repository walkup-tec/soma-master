import type { ClientFieldId } from "@/lib/config/client-fields";
import type { MenuItemId } from "@/lib/config/menu-items";

export type UserCategory = {
  id: string;
  name: string;
  menuIds: MenuItemId[];
  isDefault: boolean;
};

export type ProductConfig = {
  id: string;
  name: string;
  availableFieldIds: ClientFieldId[];
  requiredFieldIds: ClientFieldId[];
};

export type SystemSettings = {
  defaultCategoryId: string;
  categories: UserCategory[];
  products: ProductConfig[];
};
