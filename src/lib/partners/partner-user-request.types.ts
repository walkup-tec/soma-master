export type PartnerUserRequestRow = {
  id: string;
  partnerName: string;
  productName: string;
  bankName: string;
};

/** Front-only por enquanto — backend virá depois. */
export const EMPTY_PARTNER_USER_REQUESTS: PartnerUserRequestRow[] = [];
