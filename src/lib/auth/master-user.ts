export type UserRole = "master";

export type AuthUser = {
  id: string;
  login: string;
  name: string;
  role: UserRole;
};

/** Conta master inicial do sistema (senha armazenada como hash PBKDF2). */
export const MASTER_USER: AuthUser & {
  passwordSaltB64: string;
  passwordHashB64: string;
} = {
  id: "master-mozart",
  login: "mozart.sinalverde.com",
  name: "Mozart",
  role: "master",
  passwordSaltB64: "r36IKoJg2US82/GX3q5GLA==",
  passwordHashB64: "nAuRrgc5dTsSt5jZKu0LDnEFb4HNqKAsJMGvQ6g+bkY=",
};

export function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

export function findUserByLogin(login: string): typeof MASTER_USER | null {
  return normalizeLogin(login) === normalizeLogin(MASTER_USER.login) ? MASTER_USER : null;
}
