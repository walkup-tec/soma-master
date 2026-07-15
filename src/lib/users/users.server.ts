import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { loadSystemSettingsFromDisk } from "@/lib/config/settings.repository";
import { hashPassword, generateTemporaryPassword } from "@/lib/auth/password";
import { sessionConfig } from "@/lib/auth/session-config";
import {
  sendTemporaryPasswordEmail,
  sendWelcomeUserEmail,
} from "@/lib/mail/mail.service";
import {
  createUser,
  deleteUserById,
  findUserById,
  listAllUsers,
  updateUserById,
  updateUserPassword,
} from "@/lib/users/user.repository";
import type { StoredUser } from "@/lib/users/user.types";

function requireMasterSession() {
  return getSession(sessionConfig).then((session) => {
    const user = session.data;
    if (!user?.userId || user.role !== "master") {
      throw new Error("Apenas usuários master podem gerenciar usuários.");
    }
    return user;
  });
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Informe um e-mail válido.");
  }
  return email;
}

async function assertCategoryId(categoryId: string): Promise<string> {
  const id = categoryId.trim();
  const settings = await loadSystemSettingsFromDisk();
  const validIds = new Set(settings.categories.map((category) => category.id));
  if (!id || !validIds.has(id)) {
    throw new Error("Selecione uma categoria de usuário válida.");
  }
  return id;
}

const createUserSchema = (data: unknown) => {
  if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
  const { email, password, name, categoryId } = data as {
    email?: string;
    password?: string;
    name?: string;
    categoryId?: string;
  };
  if (!name?.trim()) throw new Error("Informe o nome completo.");
  if (!password || password.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres.");
  if (!categoryId?.trim()) throw new Error("Selecione uma categoria de usuário.");
  return {
    email: normalizeEmail(email ?? ""),
    password,
    name: name.trim(),
    categoryId: categoryId.trim(),
  };
};

const userIdSchema = (data: unknown) => {
  if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
  const { userId } = data as { userId?: string };
  if (!userId?.trim()) throw new Error("Usuário inválido.");
  return { userId: userId.trim() };
};

const updateUserSchema = (data: unknown) => {
  if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
  const { userId, email, password, name, categoryId } = data as {
    userId?: string;
    email?: string;
    password?: string;
    name?: string;
    categoryId?: string;
  };
  if (!userId?.trim()) throw new Error("Usuário inválido.");
  if (!name?.trim()) throw new Error("Informe o nome completo.");
  if (!categoryId?.trim()) throw new Error("Selecione uma categoria de usuário.");
  const normalizedEmail = normalizeEmail(email ?? "");
  return {
    userId: userId.trim(),
    email: normalizedEmail,
    name: name.trim(),
    categoryId: categoryId.trim(),
    password: password?.trim() ? password : undefined,
  };
};

export const listUsersFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireMasterSession();
  return listAllUsers();
});

export const createUserFn = createServerFn({ method: "POST" })
  .inputValidator(createUserSchema)
  .handler(async ({ data }) => {
    await requireMasterSession();
    const categoryId = await assertCategoryId(data.categoryId);
    const settings = await loadSystemSettingsFromDisk();
    const categoryName =
      settings.categories.find((category) => category.id === categoryId)?.name ?? categoryId;
    const { saltB64, hashB64 } = await hashPassword(data.password);
    const user: StoredUser = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      email: data.email,
      name: data.name,
      categoryId,
      role: "user",
      passwordSaltB64: saltB64,
      passwordHashB64: hashB64,
      createdAt: new Date().toISOString(),
    };
    const created = await createUser(user);
    const mail = await sendWelcomeUserEmail({
      name: created.name,
      email: created.email,
      password: data.password,
      categoryName,
      role: created.role,
      userId: created.id,
      createdAt: created.createdAt,
    });
    return { user: created, mail };
  });

export const deleteUserFn = createServerFn({ method: "POST" })
  .inputValidator(userIdSchema)
  .handler(async ({ data }) => {
    await requireMasterSession();
    await deleteUserById(data.userId);
    return { ok: true as const };
  });

export const updateUserFn = createServerFn({ method: "POST" })
  .inputValidator(updateUserSchema)
  .handler(async ({ data }) => {
    await requireMasterSession();
    const categoryId = await assertCategoryId(data.categoryId);
    return updateUserById(data.userId, {
      name: data.name,
      email: data.email,
      categoryId,
      password: data.password,
    });
  });

export const resendPasswordFn = createServerFn({ method: "POST" })
  .inputValidator(userIdSchema)
  .handler(async ({ data }) => {
    await requireMasterSession();
    const existing = await findUserById(data.userId);
    if (!existing) throw new Error("Usuário não encontrado.");
    const temporaryPassword = generateTemporaryPassword();
    const { saltB64, hashB64 } = await hashPassword(temporaryPassword);
    await updateUserPassword(data.userId, saltB64, hashB64);
    const mail = await sendTemporaryPasswordEmail({
      name: existing.name,
      email: existing.email,
      temporaryPassword,
    });
    const message =
      mail.sent === true
        ? "Nova senha gerada e enviada por e-mail."
        : mail.skipped
          ? "Nova senha gerada. E-mail desativado — copie e envie ao usuário."
          : `Nova senha gerada, mas o e-mail falhou: ${mail.error}`;
    return {
      temporaryPassword,
      mail,
      message,
    };
  });
