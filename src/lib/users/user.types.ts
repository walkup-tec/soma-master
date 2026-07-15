export type UserRole = "master" | "user";

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  categoryId: string;
  role: UserRole;
  passwordSaltB64: string;
  passwordHashB64: string;
  createdAt: string;
};

export type PublicUser = Pick<StoredUser, "id" | "email" | "name" | "categoryId" | "role" | "createdAt">;
