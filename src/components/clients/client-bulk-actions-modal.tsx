import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, ListChecks, PackagePlus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bulkAddProductFn,
  bulkDeleteClientsFn,
  bulkScheduleClientsFn,
  bulkUpdateStatusFn,
  countBulkClientsFn,
  listUsersForBulkActionsFn,
} from "@/lib/clients/clients.server";
import type { ClientBulkScope } from "@/lib/clients/client.types";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { localDateString } from "@/lib/dates/local-date";

type BulkAction = "schedule" | "product" | "status" | "delete";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ClientBulkScope | null;
  selectionLabel: string;
  onCompleted: () => void;
};

export function ClientBulkActionsModal({
  open,
  onOpenChange,
  scope,
  selectionLabel,
  onCompleted,
}: Props) {
  const { settings } = useSystemSettings();
  const countBulk = useServerFn(countBulkClientsFn);
  const scheduleBulk = useServerFn(bulkScheduleClientsFn);
  const addProductBulk = useServerFn(bulkAddProductFn);
  const updateStatusBulk = useServerFn(bulkUpdateStatusFn);
  const deleteBulk = useServerFn(bulkDeleteClientsFn);
  const listUsers = useServerFn(listUsersForBulkActionsFn);

  const [action, setAction] = useState<BulkAction>("schedule");
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [contactDateIso, setContactDateIso] = useState(() => localDateString());
  const [productId, setProductId] = useState("");
  const [statusId, setStatusId] = useState("");

  useEffect(() => {
    if (!open || !scope) return;
    let active = true;
    setLoading(true);
    Promise.all([countBulk({ data: scope }), listUsers()])
      .then(([countResult, userList]) => {
        if (!active) return;
        setTotal(countResult.total);
        setUsers(userList);
        setTargetUserId((current) => current || userList[0]?.id || "");
        setStatusId((current) => current || settings.attendanceStatuses[0]?.id || "");
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Não foi possível carregar a seleção.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, scope, countBulk, listUsers, settings.attendanceStatuses]);

  const runAction = async () => {
    if (!scope) return;
    setLoading(true);
    try {
      if (action === "schedule") {
        if (!targetUserId) throw new Error("Selecione o usuário da agenda.");
        if (!contactDateIso) throw new Error("Informe a data do contato.");
        const result = await scheduleBulk({
          data: { scope, targetUserId, contactDate: contactDateIso },
        });
        toast.success(`${result.affected} cliente(s) agendado(s).`);
      } else if (action === "product") {
        if (!productId) throw new Error("Selecione o produto.");
        const result = await addProductBulk({ data: { scope, productId } });
        toast.success(`Produto vinculado a ${result.affected} cliente(s).`);
      } else if (action === "status") {
        if (!statusId) throw new Error("Selecione o status.");
        const result = await updateStatusBulk({ data: { scope, status: statusId } });
        toast.success(`Status atualizado em ${result.affected} cliente(s).`);
      } else {
        const result = await deleteBulk({ data: scope });
        toast.success(`${result.affected} cliente(s) excluído(s).`);
      }
      onOpenChange(false);
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na ação em lote.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-5 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ações da seleção</DialogTitle>
          <DialogDescription>
            {selectionLabel}
            {total != null ? ` · ${total.toLocaleString("pt-BR")} registro(s)` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              type="button"
              variant={action === "schedule" ? "default" : "outline"}
              className="h-auto min-h-10 justify-start whitespace-normal px-3 py-2 text-left"
              onClick={() => setAction("schedule")}
            >
              <CalendarDays className="size-4 shrink-0" />
              <span>Agendar para</span>
            </Button>
            <Button
              type="button"
              variant={action === "product" ? "default" : "outline"}
              className="h-auto min-h-10 justify-start whitespace-normal px-3 py-2 text-left"
              onClick={() => setAction("product")}
            >
              <PackagePlus className="size-4 shrink-0" />
              <span>Adicionar produto</span>
            </Button>
            <Button
              type="button"
              variant={action === "status" ? "default" : "outline"}
              className="h-auto min-h-10 justify-start whitespace-normal px-3 py-2 text-left"
              onClick={() => setAction("status")}
            >
              <ListChecks className="size-4 shrink-0" />
              <span>Alterar status</span>
            </Button>
            <Button
              type="button"
              variant={action === "delete" ? "destructive" : "outline"}
              className="h-auto min-h-10 justify-start whitespace-normal px-3 py-2 text-left"
              onClick={() => setAction("delete")}
            >
              <Trash2 className="size-4 shrink-0" />
              <span>Exclusão</span>
            </Button>
          </div>

          {action === "schedule" ? (
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="space-y-2">
                <Label>Usuário da agenda</Label>
                <Select value={targetUserId || undefined} onValueChange={setTargetUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-contact-date">Data do contato</Label>
                <DatePickerField
                  id="bulk-contact-date"
                  value={contactDateIso}
                  onChange={setContactDateIso}
                  placeholder="Selecionar data"
                />
              </div>
            </div>
          ) : null}

          {action === "product" ? (
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <Label>Produto a vincular</Label>
              <Select value={productId || undefined} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {settings.products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O cliente permanece único e passa a pertencer a mais de um produto. Atendimentos ficam
                com o nome de quem registrou; ninguém exclui nota de outro usuário.
              </p>
            </div>
          ) : null}

          {action === "status" ? (
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <Label>Novo status</Label>
              <Select value={statusId || undefined} onValueChange={setStatusId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {settings.attendanceStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Aplica o status a todos os clientes da seleção (filtro ou IDs). Registra nota de
                atendimento e agenda retorno automático quando o status tiver essa regra.
              </p>
            </div>
          ) : null}

          {action === "delete" ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Exclui permanentemente os cadastros da seleção (e agendas/anexos vinculados). Apenas master.
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={action === "delete" ? "destructive" : "default"}
            disabled={loading || total === 0}
            onClick={() => void runAction()}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
