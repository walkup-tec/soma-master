import type { StoredUser } from "@/lib/users/user.types";

export const MASTER_USER_ID = "master-mozart";
export const MASTER_CATEGORY_ID = "cat-master";

/** Conta master inicial (senha armazenada como hash PBKDF2). */
export const MASTER_USER: StoredUser = {
  id: MASTER_USER_ID,
  email: "mozart@sinalverde.com",
  name: "Mozart",
  categoryId: MASTER_CATEGORY_ID,
  role: "master",
  passwordSaltB64: "r36IKoJg2US82/GX3q5GLA==",
  passwordHashB64: "nAuRrgc5dTsSt5jZKu0LDnEFb4HNqKAsJMGvQ6g+bkY=",
  createdAt: "2026-01-01T00:00:00.000Z",
};

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Aceita e-mail canônico e logins legados. */
export function emailMatchesStored(input: string, storedEmail: string): boolean {
  const normalized = normalizeEmail(input);
  const stored = normalizeEmail(storedEmail);
  if (normalized === stored) return true;
  if (stored === "mozart@sinalverde.com") {
    if (normalized === "mozart.sinalverde.com") return true;
    if (normalized === "walkup@walkuptec.com.br") return true;
  }
  return false;
}
