import { createFileRoute, redirect } from "@tanstack/react-router";
import { UserCog } from "lucide-react";
import { UsersManagement } from "@/components/users/users-management";
import { getAuthSessionFn } from "@/lib/auth/auth.server";
import { listUsersFn } from "@/lib/users/users.server";

export const Route = createFileRoute("/app/usuarios")({
  beforeLoad: async () => {
    const auth = await getAuthSessionFn();
    if (!auth || auth.role !== "master") {
      throw redirect({ to: "/app" });
    }
  },
  loader: async () => {
    const users = await listUsersFn();
    return { users };
  },
  staleTime: 30_000,
  component: UsuariosPage,
});

function UsuariosPage() {
  const { users } = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-primary">
          <UserCog className="size-5" />
          <span className="text-sm font-medium">Gestão</span>
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Usuários</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Criação, exclusão e reenvio de senha. Login do sistema com e-mail e senha.
        </p>
      </div>

      <UsersManagement initialUsers={users} />
    </div>
  );
}
