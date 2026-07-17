import { createServerFn } from "@tanstack/react-start";
import { clearSession, getSession, updateSession } from "@tanstack/react-start/server";
import { ALL_MENU_ITEM_IDS, type MenuItemId } from "@/lib/config/menu-items";
import { resolveCategoryHomeMenuId } from "@/lib/config/category-utils";
import {
  getHomeMenuIdForCategory,
  getMenuIdsForCategory,
  loadSystemSettingsFromDisk,
} from "@/lib/config/settings.repository";
import { verifyPassword } from "@/lib/auth/password";
import { sessionConfig, type SessionData } from "@/lib/auth/session-config";
import { normalizeEmail } from "@/lib/auth/master-user";
import { findUserByEmail, findUserById } from "@/lib/users/user.repository";
import { getPartnerAccess } from "@/lib/partners/partner.repository";

const ENRICH_TTL_MS = 10_000;

type EnrichCache = {
  userId: string;
  expiresAt: number;
  data: SessionData;
};

let enrichCache: EnrichCache | null = null;

const loginInputSchema = (data: unknown) => {
  if (!data || typeof data !== "object") {
    throw new Error("Dados de login inválidos.");
  }
  const { email, password } = data as { email?: string; password?: string };
  if (!email?.trim() || !password) {
    throw new Error("Informe e-mail e senha.");
  }
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && normalized !== "mozart.sinalverde.com") {
    throw new Error("Informe um e-mail válido.");
  }
  return { email: normalized, password };
};

async function resolveSessionAccess(
  userId: string,
  role: SessionData["role"],
  categoryId: string,
): Promise<{ menuIds: MenuItemId[]; homeMenuId: MenuItemId }> {
  if (role === "master") {
    const settings = await loadSystemSettingsFromDisk();
    const menuIds = [...ALL_MENU_ITEM_IDS];
    const preferred = getHomeMenuIdForCategory(settings, categoryId);
    return { menuIds, homeMenuId: resolveCategoryHomeMenuId(menuIds, preferred) };
  }
  const settings = await loadSystemSettingsFromDisk();
  const partnerAccess = await getPartnerAccess(userId);
  if (partnerAccess && partnerAccess.status !== "active") {
    throw new Error(
      partnerAccess.status === "blocked"
        ? "Esta conta está bloqueada. Contate seu responsável."
        : "Esta conta está inativa. Contate seu responsável.",
    );
  }
  const menuIds = partnerAccess?.uses_custom_menu_permissions
    ? (partnerAccess.menu_ids.filter((id): id is MenuItemId =>
        ALL_MENU_ITEM_IDS.includes(id as MenuItemId),
      ) as MenuItemId[])
    : getMenuIdsForCategory(settings, categoryId);
  const preferred = getHomeMenuIdForCategory(settings, categoryId);
  return { menuIds, homeMenuId: resolveCategoryHomeMenuId(menuIds, preferred) };
}

function sessionNeedsPersist(session: SessionData, next: SessionData): boolean {
  return (
    session.name !== next.name ||
    session.email !== next.email ||
    session.categoryId !== next.categoryId ||
    session.menuIds.join(",") !== next.menuIds.join(",") ||
    session.homeMenuId !== next.homeMenuId
  );
}

/** Sincroniza sessão com o cadastro atual (categoria, nome, menus). */
async function enrichSession(session: SessionData): Promise<SessionData | null> {
  const now = Date.now();
  const user = await findUserById(session.userId);
  if (!user) {
    await clearSession(sessionConfig);
    return null;
  }

  const categoryId = user.categoryId;
  let access: { menuIds: MenuItemId[]; homeMenuId: MenuItemId };
  try {
    access = await resolveSessionAccess(user.id, user.role, categoryId);
  } catch {
    await clearSession(sessionConfig);
    return null;
  }
  const { menuIds, homeMenuId } = access;

  if (
    enrichCache &&
    enrichCache.userId === session.userId &&
    enrichCache.expiresAt > now &&
    enrichCache.data.menuIds.join(",") === menuIds.join(",") &&
    enrichCache.data.homeMenuId === homeMenuId &&
    enrichCache.data.categoryId === categoryId &&
    enrichCache.data.name === user.name
  ) {
    return enrichCache.data;
  }

  const next: SessionData = {
    ...session,
    name: user.name,
    email: user.email,
    role: user.role,
    categoryId,
    menuIds,
    homeMenuId,
  };

  if (sessionNeedsPersist(session, next)) {
    await updateSession(sessionConfig, next);
  }

  enrichCache = {
    userId: session.userId,
    expiresAt: now + ENRICH_TTL_MS,
    data: next,
  };

  return next;
}

export function invalidateAuthEnrichCache(): void {
  enrichCache = null;
}

export const getAuthSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession<SessionData>(sessionConfig);
  const user = session.data;
  if (!user?.userId) return null;
  return enrichSession(user as SessionData);
});

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator(loginInputSchema)
  .handler(async ({ data }) => {
    invalidateAuthEnrichCache();
    const user = await findUserByEmail(data.email);
    if (!user) {
      throw new Error("E-mail ou senha incorretos.");
    }

    const valid = await verifyPassword(data.password, user.passwordSaltB64, user.passwordHashB64);
    if (!valid) {
      throw new Error("E-mail ou senha incorretos.");
    }

    const { menuIds, homeMenuId } = await resolveSessionAccess(user.id, user.role, user.categoryId);
    const sessionData = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      categoryId: user.categoryId,
      menuIds,
      homeMenuId,
    } satisfies SessionData;

    await updateSession(sessionConfig, sessionData);
    enrichCache = {
      userId: sessionData.userId,
      expiresAt: Date.now() + ENRICH_TTL_MS,
      data: sessionData,
    };
    return sessionData;
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  invalidateAuthEnrichCache();
  await clearSession(sessionConfig);
  return { ok: true as const };
});
