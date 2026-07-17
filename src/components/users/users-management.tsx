import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useSystemSettings } from "@/hooks/use-system-settings";
import {
  createUserFn,
  deleteUserFn,
  listUsersFn,
  resendPasswordFn,
  updateUserFn,
} from "@/lib/users/users.server";
import type { PublicUser } from "@/lib/users/user.types";

type Props = {
  initialUsers: PublicUser[];
};

export function UsersManagement({ initialUsers }: Props) {
  const { settings } = useSystemSettings();
  const listUsers = useServerFn(listUsersFn);
  const createUser = useServerFn(createUserFn);
  const updateUser = useServerFn(updateUserFn);
  const deleteUser = useServerFn(deleteUserFn);
  const resendPassword = useServerFn(resendPasswordFn);

  const [users, setUsers] = useState(initialUsers);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<PublicUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PublicUser | null>(null);
  const [passwordDialog, setPasswordDialog] = useState<{
    userName: string;
    password: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(settings.categories[0]?.id ?? "");

  const categoryName = (id: string) => settings.categories.find((c) => c.id === id)?.name ?? id;

  const refreshUsers = async () => {
    const next = await listUsers();
    setUsers(next);
  };

  const resetCreateForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setCategoryId(settings.categories[0]?.id ?? "");
  };

  const openEdit = (user: PublicUser) => {
    setEditUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword("");
    setCategoryId(user.categoryId);
  };

  const closeEdit = () => {
    setEditUser(null);
    setPassword("");
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const result = await createUser({ data: { email, password, name, categoryId } });
      await refreshUsers();
      setCreateOpen(false);
      resetCreateForm();
      const mailOk = result.mail.sent;
      const mailSkipped = result.mail.skipped;
      const wa = result.whatsapp;
      if (mailOk && wa.sent) {
        toast.success("Usuário criado. Boas-vindas enviadas por e-mail e WhatsApp.");
      } else if (mailOk) {
        toast.success(
          wa.skipped
            ? "Usuário criado e e-mail de boas-vindas enviado."
            : `Usuário criado e e-mail enviado. WhatsApp falhou: ${wa.error}`,
        );
      } else if (mailSkipped) {
        toast.success("Usuário criado. E-mail desativado (MAIL_MODE).");
      } else {
        toast.warning(`Usuário criado, mas o e-mail falhou: ${result.mail.error}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o usuário.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    setLoading(true);
    try {
      await updateUser({
        data: {
          userId: editUser.id,
          email,
          name,
          categoryId,
          password: password || undefined,
        },
      });
      await refreshUsers();
      closeEdit();
      toast.success("Usuário atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o usuário.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      await deleteUser({ data: { userId: deleteTarget.id } });
      await refreshUsers();
      setDeleteTarget(null);
      if (editUser?.id === deleteTarget.id) closeEdit();
      toast.success("Usuário excluído.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir o usuário.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendPassword = async (user: PublicUser) => {
    setLoading(true);
    try {
      const result = await resendPassword({ data: { userId: user.id } });
      setPasswordDialog({ userName: user.name, password: result.temporaryPassword });
      toast.success(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="border-border/60 shadow-soft">
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="font-display text-base">Usuários do sistema</CardTitle>
            <CardDescription>
              Edite ou remova usuários. Crie contas com e-mail, senha e categoria.
            </CardDescription>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Novo usuário
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{categoryName(user.categoryId)}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "master" ? "default" : "secondary"}>
                      {user.role === "master" ? "Master" : "Usuário"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="size-4" /> Editar
                      </Button>
                      {user.role !== "master" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={loading}
                          onClick={() => setDeleteTarget(user)}
                        >
                          <Trash2 className="size-4" /> Remover
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5" /> Novo usuário
            </DialogTitle>
            <DialogDescription>
              E-mail e senha serão usados no login. A categoria define os menus e permissões.
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-user-name">Nome completo</Label>
              <Input
                id="create-user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome e sobrenome"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-user-email">E-mail</Label>
              <Input
                id="create-user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@sinalverde.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-user-password">Senha</Label>
              <Input
                id="create-user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria de usuário</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {settings.categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={loading || !email || !password || !name || !categoryId}
              onClick={handleCreate}
            >
              Criar usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editUser)} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-5 shrink-0" /> Editar usuário
            </DialogTitle>
            <DialogDescription>
              Altere nome, e-mail, senha ou categoria. Deixe a senha em branco para manter a atual.
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-user-name">Nome completo</Label>
              <Input
                id="edit-user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome e sobrenome"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-user-email">E-mail</Label>
              <Input
                id="edit-user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@sinalverde.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-user-password">Nova senha</Label>
              <Input
                id="edit-user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para manter a atual"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria de usuário</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {settings.categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="!flex-col items-stretch gap-3">
            {editUser?.role !== "master" ? (
              <div className="flex w-full flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:flex-1"
                  disabled={loading}
                  onClick={() => editUser && handleResendPassword(editUser)}
                >
                  <KeyRound className="size-4" /> Reenviar senha
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive sm:flex-1"
                  disabled={loading}
                  onClick={() => editUser && setDeleteTarget(editUser)}
                >
                  <Trash2 className="size-4" /> Excluir
                </Button>
              </div>
            ) : null}
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={closeEdit}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={loading || !email || !name || !categoryId}
                onClick={handleUpdate}
              >
                Salvar alterações
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(passwordDialog)}
        onOpenChange={(open) => !open && setPasswordDialog(null)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova senha gerada</DialogTitle>
            <DialogDescription>
              Senha temporária para <strong>{passwordDialog?.userName}</strong>. Se o e-mail foi
              enviado, o usuário já recebeu; use esta cópia como reserva.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 font-mono text-sm">
            {passwordDialog?.password}
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                if (passwordDialog?.password) {
                  void navigator.clipboard.writeText(passwordDialog.password);
                  toast.success("Senha copiada.");
                }
              }}
            >
              Copiar senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
