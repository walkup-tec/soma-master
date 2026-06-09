import type { UserRole } from "@/lib/auth/master-user";

export type SessionData = {
  userId: string;
  login: string;
  name: string;
  role: UserRole;
};

export function getSessionPassword(): string {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET é obrigatório em produção.");
  }
  return "dev-only-sinal-verde-session-secret-min-32-chars!!";
}

export const sessionConfig = {
  get password() {
    return getSessionPassword();
  },
  name: "sinal-verde-session",
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  },
  maxAge: 60 * 60 * 24 * 7,
};
