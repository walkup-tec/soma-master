import { redirect } from "@tanstack/react-router";
import { getAuthSessionFn } from "@/lib/auth/auth.server";
import { sessionCanAccessPath, firstAllowedAppPath } from "@/lib/auth/menu-access";

export async function guardAppMenuAccess(pathname: string) {
  const auth = await getAuthSessionFn();
  if (!auth) {
    throw redirect({ to: "/login" });
  }
  if (!sessionCanAccessPath(auth, pathname)) {
    throw redirect({ to: firstAllowedAppPath(auth) });
  }
  return auth;
}
