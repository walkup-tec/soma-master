import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hashPassword } from "@/lib/auth/password";
import { emailMatchesStored, MASTER_USER, MASTER_USER_ID, normalizeEmail } from "@/lib/auth/master-user";
import type { PublicUser, StoredUser } from "@/lib/users/user.types";
import { getSql, isDatabaseEnabled } from "@/lib/db/postgres";

const DATA_DIR = join(process.cwd(), "data");
const USERS_FILE = join(DATA_DIR, "users.json");
const MASTER_USER_FILE = join(DATA_DIR, "master-user.json");

export type UpdateUserInput = {
  name: string;
  email: string;
  categoryId: string;
  password?: string;
};

let cachedUsers: StoredUser[] | null = null;
let cachedMasterUser: StoredUser | null = null;

type UserRow = {
  id: string;
  email: string;
  name: string;
  category_id: string | null;
  role: string;
  password_salt_b64: string;
  password_hash_b64: string;
  created_at: Date;
};

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    categoryId: user.categoryId,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function mapUserRow(row: UserRow): StoredUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    categoryId: row.category_id ?? MASTER_USER.categoryId,
    role: row.role as StoredUser["role"],
    passwordSaltB64: row.password_salt_b64,
    passwordHashB64: row.password_hash_b64,
    createdAt: row.created_at.toISOString(),
  };
}

async function readStoredUsers(): Promise<StoredUser[]> {
  try {
    const raw = await readFile(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoredUser[];
    return Array.isArray(parsed) ? parsed.filter((u) => u.id !== MASTER_USER_ID) : [];
  } catch {
    return [];
  }
}

async function writeStoredUsers(users: StoredUser[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

async function getMutableUsers(): Promise<StoredUser[]> {
  if (!cachedUsers) {
    cachedUsers = await readStoredUsers();
  }
  return cachedUsers;
}

async function readMasterUserFromDisk(): Promise<StoredUser> {
  if (cachedMasterUser) return cachedMasterUser;
  try {
    const raw = await readFile(MASTER_USER_FILE, "utf8");
    const overrides = JSON.parse(raw) as Partial<StoredUser>;
    cachedMasterUser = { ...MASTER_USER, ...overrides, id: MASTER_USER_ID, role: "master" };
  } catch {
    cachedMasterUser = { ...MASTER_USER };
  }
  return cachedMasterUser;
}

async function writeMasterUserToDisk(user: StoredUser): Promise<void> {
  cachedMasterUser = user;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(MASTER_USER_FILE, JSON.stringify(user, null, 2), "utf8");
}

async function listUsersFromPostgres(): Promise<StoredUser[]> {
  const sql = await getSql();
  const rows = await sql<UserRow[]>`
    select id, email, name, category_id, role, password_salt_b64, password_hash_b64, created_at
    from crm.users
    order by created_at
  `;
  return rows.map(mapUserRow);
}

async function findUserByEmailFromPostgres(email: string): Promise<StoredUser | null> {
  const users = await listUsersFromPostgres();
  return users.find((user) => emailMatchesStored(email, user.email)) ?? null;
}

async function findUserByIdFromPostgres(userId: string): Promise<StoredUser | null> {
  const sql = await getSql();
  const rows = await sql<UserRow[]>`
    select id, email, name, category_id, role, password_salt_b64, password_hash_b64, created_at
    from crm.users
    where id = ${userId}
    limit 1
  `;
  return rows[0] ? mapUserRow(rows[0]) : null;
}

async function upsertUserInPostgres(user: StoredUser): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into crm.users (
      id, email, name, category_id, role, password_salt_b64, password_hash_b64, created_at, updated_at
    ) values (
      ${user.id},
      ${user.email},
      ${user.name},
      ${user.categoryId},
      ${user.role},
      ${user.passwordSaltB64},
      ${user.passwordHashB64},
      ${user.createdAt},
      now()
    )
    on conflict (id) do update set
      email = excluded.email,
      name = excluded.name,
      category_id = excluded.category_id,
      role = excluded.role,
      password_salt_b64 = excluded.password_salt_b64,
      password_hash_b64 = excluded.password_hash_b64,
      updated_at = now()
  `;
}

function emailTakenByOther(users: StoredUser[], email: string, exceptUserId?: string): boolean {
  const normalized = normalizeEmail(email);
  return users.some(
    (user) => user.id !== exceptUserId && normalizeEmail(user.email) === normalized,
  );
}

export async function listAllUsers(): Promise<PublicUser[]> {
  if (isDatabaseEnabled()) {
    const users = await listUsersFromPostgres();
    return users.map(toPublicUser);
  }

  const master = await readMasterUserFromDisk();
  const users = await getMutableUsers();
  return [toPublicUser(master), ...users.map(toPublicUser)];
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  if (isDatabaseEnabled()) {
    return findUserByEmailFromPostgres(email);
  }

  const master = await readMasterUserFromDisk();
  if (emailMatchesStored(email, master.email)) return master;

  const users = await getMutableUsers();
  return users.find((user) => emailMatchesStored(email, user.email)) ?? null;
}

export async function findUserById(userId: string): Promise<StoredUser | null> {
  if (isDatabaseEnabled()) {
    return findUserByIdFromPostgres(userId);
  }

  if (userId === MASTER_USER_ID) return readMasterUserFromDisk();
  const users = await getMutableUsers();
  return users.find((user) => user.id === userId) ?? null;
}

export async function createUser(user: StoredUser): Promise<PublicUser> {
  if (isDatabaseEnabled()) {
    const existing = await findUserByEmailFromPostgres(user.email);
    if (existing) throw new Error("Já existe um usuário com este e-mail.");
    await upsertUserInPostgres(user);
    return toPublicUser(user);
  }

  const users = await getMutableUsers();
  if (users.some((item) => normalizeEmail(item.email) === normalizeEmail(user.email))) {
    throw new Error("Já existe um usuário com este e-mail.");
  }
  users.push(user);
  cachedUsers = users;
  await writeStoredUsers(users);
  return toPublicUser(user);
}

export async function deleteUserById(userId: string): Promise<void> {
  if (userId === MASTER_USER_ID) {
    throw new Error("A conta master não pode ser excluída.");
  }

  if (isDatabaseEnabled()) {
    const sql = await getSql();
    const rows = await sql`
      delete from crm.users where id = ${userId} and role <> 'master'
      returning id
    `;
    if (rows.length === 0) throw new Error("Usuário não encontrado.");
    return;
  }

  const users = await getMutableUsers();
  const next = users.filter((user) => user.id !== userId);
  if (next.length === users.length) {
    throw new Error("Usuário não encontrado.");
  }
  cachedUsers = next;
  await writeStoredUsers(next);
}

export async function updateUserPassword(userId: string, passwordSaltB64: string, passwordHashB64: string): Promise<void> {
  if (isDatabaseEnabled()) {
    const user = await findUserByIdFromPostgres(userId);
    if (!user) throw new Error("Usuário não encontrado.");
    await upsertUserInPostgres({ ...user, passwordSaltB64, passwordHashB64 });
    return;
  }

  if (userId === MASTER_USER_ID) {
    const master = await readMasterUserFromDisk();
    await writeMasterUserToDisk({ ...master, passwordSaltB64, passwordHashB64 });
    return;
  }
  const users = await getMutableUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index < 0) {
    throw new Error("Usuário não encontrado.");
  }
  users[index] = { ...users[index], passwordSaltB64, passwordHashB64 };
  cachedUsers = users;
  await writeStoredUsers(users);
}

export async function updateUserById(userId: string, input: UpdateUserInput): Promise<PublicUser> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const categoryId = input.categoryId.trim();

  if (!name) throw new Error("Informe o nome completo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
  if (!categoryId) throw new Error("Selecione uma categoria de usuário.");

  let passwordSaltB64: string | undefined;
  let passwordHashB64: string | undefined;
  if (input.password) {
    if (input.password.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres.");
    const hashed = await hashPassword(input.password);
    passwordSaltB64 = hashed.saltB64;
    passwordHashB64 = hashed.hashB64;
  }

  if (isDatabaseEnabled()) {
    const allUsers = await listUsersFromPostgres();
    const current = allUsers.find((user) => user.id === userId);
    if (!current) throw new Error("Usuário não encontrado.");
    if (emailTakenByOther(allUsers, email, userId)) {
      throw new Error("Já existe um usuário com este e-mail.");
    }
    const updated: StoredUser = {
      ...current,
      name,
      email,
      categoryId,
      ...(passwordSaltB64 && passwordHashB64 ? { passwordSaltB64, passwordHashB64 } : {}),
    };
    await upsertUserInPostgres(updated);
    return toPublicUser(updated);
  }

  if (userId === MASTER_USER_ID) {
    const master = await readMasterUserFromDisk();
    const users = await getMutableUsers();
    if (emailTakenByOther(users, email)) {
      throw new Error("Já existe um usuário com este e-mail.");
    }
    const updated: StoredUser = {
      ...master,
      name,
      email,
      categoryId,
      ...(passwordSaltB64 && passwordHashB64 ? { passwordSaltB64, passwordHashB64 } : {}),
    };
    await writeMasterUserToDisk(updated);
    return toPublicUser(updated);
  }

  const users = await getMutableUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index < 0) throw new Error("Usuário não encontrado.");

  const master = await readMasterUserFromDisk();
  if (emailMatchesStored(email, master.email) || emailTakenByOther(users, email, userId)) {
    throw new Error("Já existe um usuário com este e-mail.");
  }

  users[index] = {
    ...users[index],
    name,
    email,
    categoryId,
    ...(passwordSaltB64 && passwordHashB64 ? { passwordSaltB64, passwordHashB64 } : {}),
  };
  cachedUsers = users;
  await writeStoredUsers(users);
  return toPublicUser(users[index]);
}
