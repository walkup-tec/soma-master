import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Ban,
  CircleCheck,
  CircleOff,
  History,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { PartnerFormDialog } from "@/components/partners/partner-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PARTNER_BANKS,
  PARTNER_STATUSES,
  partnerCategoryLabel,
} from "@/lib/partners/partner.constants";
import {
  changePartnerStatusFn,
  listPartnerEventsFn,
  listPartnersFn,
} from "@/lib/partners/partners.server";
import type {
  PartnerEventRecord,
  PartnerListResult,
  PartnerProductionFilter,
  PartnerRecord,
  PartnerStatus,
} from "@/lib/partners/partner.types";

const PAGE_SIZE = 20;

function formatDocument(value: string): string {
  if (value.length === 11) {
    return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (value.length === 14) {
    return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return value || "—";
}

function formatPhone(value: string): string {
  if (value.length === 11) return value.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (value.length === 10) return value.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return value || "—";
}

function statusBadge(status: PartnerStatus) {
  if (status === "active")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
        Ativo
      </Badge>
    );
  if (status === "blocked") return <Badge variant="destructive">Bloqueado</Badge>;
  return <Badge variant="secondary">Inativo</Badge>;
}

const EVENT_LABELS: Record<PartnerEventRecord["action"], string> = {
  created: "Cadastro criado",
  updated: "Cadastro atualizado",
  activated: "Parceiro ativado",
  inactivated: "Parceiro inativado",
  blocked: "Parceiro bloqueado",
  unblocked: "Parceiro desbloqueado",
};

export function PartnersScreen({ initialData }: { initialData: PartnerListResult }) {
  const listPartners = useServerFn(listPartnersFn);
  const changeStatus = useServerFn(changePartnerStatusFn);
  const listEvents = useServerFn(listPartnerEventsFn);
  const requestId = useRef(0);

  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState<PartnerStatus>("active");
  const [search, setSearch] = useState("");
  const [production, setProduction] = useState<PartnerProductionFilter>("all");
  const [bankIds, setBankIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerRecord | null>(null);
  const [statusTarget, setStatusTarget] = useState<{
    partner: PartnerRecord;
    status: PartnerStatus;
  } | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [eventsTarget, setEventsTarget] = useState<PartnerRecord | null>(null);
  const [events, setEvents] = useState<PartnerEventRecord[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [mutating, setMutating] = useState(false);

  const refresh = async (overrides?: { page?: number }) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const next = await listPartners({
        data: {
          status,
          search,
          production,
          bankIds,
          page: overrides?.page ?? page,
          pageSize: PAGE_SIZE,
        },
      });
      if (currentRequest === requestId.current) setData(next);
    } catch (error) {
      if (currentRequest === requestId.current) {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível carregar os parceiros.",
        );
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search, production, bankIds, page]);

  const changeTab = (nextStatus: string) => {
    setStatus(nextStatus as PartnerStatus);
    setPage(1);
  };

  const openCreate = () => {
    setEditingPartner(null);
    setFormOpen(true);
  };

  const openEdit = (partner: PartnerRecord) => {
    setEditingPartner(partner);
    setFormOpen(true);
  };

  const confirmStatus = async () => {
    if (!statusTarget) return;
    if (statusTarget.status === "blocked" && blockReason.trim().length < 3) {
      toast.error("Informe o motivo do bloqueio.");
      return;
    }
    setMutating(true);
    try {
      await changeStatus({
        data: {
          partnerId: statusTarget.partner.id,
          status: statusTarget.status,
          reason: statusTarget.status === "blocked" ? blockReason : undefined,
        },
      });
      toast.success(
        statusTarget.status === "active"
          ? "Parceiro ativado."
          : statusTarget.status === "inactive"
            ? "Parceiro inativado."
            : "Parceiro bloqueado.",
      );
      setStatusTarget(null);
      setBlockReason("");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar o status.");
    } finally {
      setMutating(false);
    }
  };

  const openEvents = async (partner: PartnerRecord) => {
    setEventsTarget(partner);
    setEvents([]);
    setEventsLoading(true);
    try {
      setEvents(await listEvents({ data: { partnerId: partner.id } }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível carregar o histórico.",
      );
    } finally {
      setEventsLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <UsersRound className="size-5" />
            <span className="text-sm font-medium">Rede de parceiros</span>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Parceiros</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre e gerencie somente os parceiros abaixo de você na hierarquia.
          </p>
        </div>
        {data.canCreatePartners ? (
          <Button type="button" onClick={openCreate}>
            <Plus className="size-4" /> Novo parceiro
          </Button>
        ) : null}
      </div>

      <Tabs value={status} onValueChange={changeTab}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full justify-start sm:min-w-0">
            {PARTNER_STATUSES.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="gap-2">
                {item.label}
                <Badge
                  variant="secondary"
                  className="h-5 min-w-5 justify-center px-1.5 text-[10px]"
                >
                  {data.counts[item.value]}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <Card className="border-border/60 shadow-soft">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por nome, e-mail, CPF/CNPJ ou telefone"
                className="pl-9"
              />
            </div>
            <Select
              value={production}
              onValueChange={(value) => {
                setProduction(value as PartnerProductionFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full lg:w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda produção</SelectItem>
                <SelectItem value="with">Com produção</SelectItem>
                <SelectItem value="without">Sem produção</SelectItem>
              </SelectContent>
            </Select>
            <MultiSelectFilter
              allLabel="Todos os bancos"
              values={bankIds}
              options={PARTNER_BANKS.map((bank) => ({ value: bank.id, label: bank.name }))}
              onChange={(values) => {
                setBankIds(values);
                setPage(1);
              }}
              className="lg:w-[210px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto">
            {loading ? (
              <div className="absolute inset-0 z-10 grid min-h-40 place-items-center bg-background/70 backdrop-blur-[1px]">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo de usuário</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                      Nenhum parceiro encontrado nesta situação.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell>
                        <div className="font-medium">{partner.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Responsável: {partner.parentName ?? "Master"}
                        </div>
                      </TableCell>
                      <TableCell>{partnerCategoryLabel(partner.category)}</TableCell>
                      <TableCell>{partner.email}</TableCell>
                      <TableCell>{formatDocument(partner.taxId)}</TableCell>
                      <TableCell>{formatPhone(partner.phone)}</TableCell>
                      <TableCell>{statusBadge(partner.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label={`Ações de ${partner.name}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(partner)}>
                              <Pencil className="size-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void openEvents(partner)}>
                              <History className="size-4" /> Histórico
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {partner.status !== "active" ? (
                              <DropdownMenuItem
                                onClick={() => setStatusTarget({ partner, status: "active" })}
                              >
                                <CircleCheck className="size-4" /> Ativar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setStatusTarget({ partner, status: "inactive" })}
                              >
                                <CircleOff className="size-4" /> Inativar
                              </DropdownMenuItem>
                            )}
                            {partner.status !== "blocked" ? (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  setBlockReason("");
                                  setStatusTarget({ partner, status: "blocked" });
                                }}
                              >
                                <Ban className="size-4" /> Bloquear
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">
              {data.total} parceiro{data.total === 1 ? "" : "s"} · Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PartnerFormDialog
        open={formOpen}
        partner={editingPartner}
        allowedMenuIds={data.allowedMenuIds}
        onOpenChange={setFormOpen}
        onSaved={() => refresh({ page: 1 })}
      />

      <Dialog open={Boolean(statusTarget)} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {statusTarget?.status === "blocked"
                ? "Bloquear parceiro"
                : statusTarget?.status === "inactive"
                  ? "Inativar parceiro"
                  : "Ativar parceiro"}
            </DialogTitle>
            <DialogDescription>
              {statusTarget?.status === "blocked"
                ? "O motivo é obrigatório e ficará registrado no histórico."
                : `Confirme a alteração de status de ${statusTarget?.partner.name ?? "parceiro"}.`}
            </DialogDescription>
          </DialogHeader>
          {statusTarget?.status === "blocked" ? (
            <div className="space-y-2">
              <Label htmlFor="partner-block-reason">Motivo do bloqueio</Label>
              <Input
                id="partner-block-reason"
                value={blockReason}
                onChange={(event) => setBlockReason(event.target.value)}
                placeholder="Descreva objetivamente o motivo"
                maxLength={500}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutating}
              onClick={() => setStatusTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={statusTarget?.status === "blocked" ? "destructive" : "default"}
              disabled={mutating}
              onClick={confirmStatus}
            >
              {mutating ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(eventsTarget)} onOpenChange={(open) => !open && setEventsTarget(null)}>
        <DialogContent className="max-h-[80dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de eventos</DialogTitle>
            <DialogDescription>{eventsTarget?.name}</DialogDescription>
          </DialogHeader>
          {eventsLoading ? (
            <div className="grid h-32 place-items-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : events.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum evento registrado.
            </p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium">{EVENT_LABELS[event.action]}</span>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString("pt-BR")}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Por {event.actorName}</p>
                  {event.reason ? <p className="mt-2 text-sm">{event.reason}</p> : null}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
