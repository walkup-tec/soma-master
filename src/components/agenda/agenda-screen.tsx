import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientListActionLayer } from "@/components/clients/client-list-action-layer";
import { ClientsDataTable } from "@/components/clients/clients-data-table";
import type { ClientActionKind } from "@/components/clients/client-action-modals";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { listAgendaFn } from "@/lib/clients/agenda.server";
import {
  resolveAttendanceStatusColor,
  resolveAttendanceStatusLabel,
} from "@/lib/clients/client-status";
import type { AgendaFilter, ClientListItem } from "@/lib/clients/client.types";
import { cn } from "@/lib/utils";

type Props = {
  initialFilter: AgendaFilter;
  initialPendingOnly: boolean;
  initialItems: ClientListItem[];
};

const FILTERS: { id: AgendaFilter; label: string; pendingOnly?: boolean }[] = [
  { id: "today", label: "Hoje" },
  { id: "tomorrow", label: "Amanhã" },
  { id: "overdue", label: "Atrasados" },
  { id: "all", label: "Todos" },
];

function emptyMessage(filter: AgendaFilter, pendingOnly: boolean) {
  if (filter === "today" && pendingOnly) {
    return "Nenhum atendimento pendente para hoje.";
  }
  if (filter === "today") return "Nenhum lead agendado para hoje.";
  if (filter === "tomorrow") return "Nenhum lead agendado para amanhã.";
  if (filter === "overdue") return "Nenhum atendimento atrasado pendente.";
  return "Nenhum lead com agenda registrada.";
}

export function AgendaScreen({ initialFilter, initialPendingOnly, initialItems }: Props) {
  const navigate = useNavigate();
  const { settings } = useSystemSettings();
  const listAgenda = useServerFn(listAgendaFn);
  const [filter, setFilter] = useState<AgendaFilter>(initialFilter);
  const [pendingOnly, setPendingOnly] = useState(initialPendingOnly);
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [actionClient, setActionClient] = useState<ClientListItem | null>(null);
  const [actionKind, setActionKind] = useState<ClientActionKind | null>(null);

  useEffect(() => {
    setFilter(initialFilter);
    setPendingOnly(initialPendingOnly);
    setItems(initialItems);
    setLoading(false);
  }, [initialFilter, initialPendingOnly, initialItems]);

  const loadAgenda = useCallback(
    async (nextFilter: AgendaFilter, nextPendingOnly: boolean) => {
      const resolvedPending = nextFilter === "overdue" ? true : nextPendingOnly;
      setFilter(nextFilter);
      setPendingOnly(resolvedPending);
      setLoading(true);
      try {
        const nextItems = await listAgenda({
          data: { filter: nextFilter, pendingOnly: resolvedPending },
        });
        setItems(nextItems);
        void navigate({
          to: "/app/agenda",
          search: {
            filter: nextFilter,
            pending: resolvedPending ? "1" : undefined,
          },
          replace: true,
        });
      } finally {
        setLoading(false);
      }
    },
    [listAgenda, navigate],
  );

  const productMeta = (productId: string) => {
    const product = settings.products.find((item) => item.id === productId);
    return {
      label: product ? (product.tag.trim() || product.name) : productId,
      color: product?.color ?? "#64748b",
    };
  };

  const statusLabel = (statusId: string) => resolveAttendanceStatusLabel(statusId, settings);
  const statusColor = (statusId: string) => resolveAttendanceStatusColor(statusId, settings);

  const openAction = (client: ClientListItem, action: ClientActionKind) => {
    setActionClient(client);
    setActionKind(action);
  };

  const closeAction = useCallback(() => {
    setActionClient(null);
    setActionKind(null);
  }, []);

  const patchClient = useCallback((clientId: string, patch: Partial<ClientListItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === clientId ? { ...item, ...patch } : item)),
    );
    setActionClient((current) =>
      current?.id === clientId ? { ...current, ...patch } : current,
    );
  }, []);

  const isAgendaDoDia = filter === "today" && pendingOnly;

  return (
    <>
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <CalendarDays className="size-5" />
            <span className="text-sm font-medium">Comercial</span>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Agenda</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Leads com data de contato agendada na tela de Clientes.
          </p>
        </div>

        <Card className="border-border/60 shadow-soft">
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-base">Contatos agendados</CardTitle>
              <CardDescription>
                {loading
                  ? "Atualizando lista…"
                  : filter === "today" && pendingOnly
                    ? `${items.length.toLocaleString("pt-BR")} pendente(s) para hoje`
                    : `${items.length.toLocaleString("pt-BR")} lead(s) neste filtro`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((option) => {
                const active = option.id === filter;
                const agendaDoDiaAtivo = isAgendaDoDia && option.id === "today";
                return (
                  <Button
                    key={option.id}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className={cn(
                      agendaDoDiaAtivo &&
                        "border-login-brand bg-login-brand text-primary-foreground hover:bg-login-brand/90",
                    )}
                    disabled={loading}
                    onClick={() => void loadAgenda(option.id, false)}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent>
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Carregando agenda…
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 px-6 py-10 text-center text-sm text-muted-foreground">
                {emptyMessage(filter, pendingOnly)}
              </div>
            ) : (
              <ClientsDataTable
                items={items}
                productMeta={productMeta}
                statusLabel={statusLabel}
                statusColor={statusColor}
                onAction={openAction}
                dimmed={loading}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ClientListActionLayer
        actionClient={actionClient}
        actionKind={actionKind}
        onClose={closeAction}
        onClientPatch={patchClient}
      />
    </>
  );
}
