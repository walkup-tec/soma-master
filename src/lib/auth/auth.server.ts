import { createServerFn } from "@tanstack/react-start";
import { clearSession, getSession, updateSession } from "@tanstack/react-start/server";
import { findUserByLogin } from "@/lib/auth/master-user";
import { verifyPassword } from "@/lib/auth/password";
import { sessionConfig, type SessionData } from "@/lib/auth/session-config";

const loginInputSchema = (data: unknown) => {
  if (!data || typeof data !== "object") {
    throw new Error("Dados de login inválidos.");
  }
  const { login, password } = data as { login?: string; password?: string };
  if (!login?.trim() || !password) {
    throw new Error("Informe login e senha.");
  }
  return { login: login.trim(), password };
};

export const getAuthSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession<SessionData>(sessionConfig);
  const user = session.data;
  if (!user?.userId) return null;
  return user;
});

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator(loginInputSchema)
  .handler(async ({ data }) => {
    const user = findUserByLogin(data.login);
    if (!user) {
      throw new Error("Login ou senha incorretos.");
    }

    const valid = await verifyPassword(data.password, user.passwordSaltB64, user.passwordHashB64);
    if (!valid) {
      throw new Error("Login ou senha incorretos.");
    }

    await updateSession(sessionConfig, {
      userId: user.id,
      login: user.login,
      name: user.name,
      role: user.role,
    });

    return {
      userId: user.id,
      login: user.login,
      name: user.name,
      role: user.role,
    } satisfies SessionData;
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await clearSession(sessionConfig);
  return { ok: true as const };
});
