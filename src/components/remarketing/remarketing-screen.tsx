import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientListActionLayer } from "@/components/clients/client-list-action-layer";
import { ClientsDataTable } from "@/components/clients/clients-data-table";
import type { ClientActionKind } from "@/components/clients/client-action-modals";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { listRemarketingFn } from "@/lib/clients/remarketing.server";
import {
  resolveAttendanceStatusColor,
  resolveAttendanceStatusLabel,
} from "@/lib/clients/client-status";
import type {
  ClientListItem,
  RemarketingFilter,
  RemarketingListItem,
} from "@/lib/clients/client.types";
import { formatLocalDateLabel, resolveRemarketingDateRange } from "@/lib/dates/local-date";
import { cn } from "@/lib/utils";

type Props = {
  initialFilter: RemarketingFilter;
  initialItems: RemarketingListItem[];
};

const FILTERS: { id: RemarketingFilter; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Semana" },
  { id: "next15", label: "Próximos 15 Dias" },
  { id: "next30", label: "Próximos 30 Dias" },
];

function emptyMessage(filter: RemarketingFilter) {
  if (filter === "today") return "Nenhum cliente com agenda para hoje.";
  if (filter === "week") return "Nenhum cliente com agenda nos próximos 7 dias.";
  if (filter === "next15") return "Nenhum cliente com agenda nos próximos 15 dias.";
  return "Nenhum cliente com agenda nos próximos 30 dias.";
}

function filterRangeHint(filter: RemarketingFilter) {
  const { from, to } = resolveRemarketingDateRange(filter);
  if (from === to) return formatLocalDateLabel(from);
  return `${formatLocalDateLabel(from)} — ${formatLocalDateLabel(to)}`;
}

export function RemarketingScreen({ initialFilter, initialItems }: Props) {
  const navigate = useNavigate();
  const { settings } = useSystemSettings();
  const listRemarketing = useServerFn(listRemarketingFn);
  const [filter, setFilter] = useState<RemarketingFilter>(initialFilter);
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [actionClient, setActionClient] = useState<RemarketingListItem | null>(null);
  const [actionKind, setActionKind] = useState<ClientActionKind | null>(null);

  useEffect(() => {
    setFilter(initialFilter);
    setItems(initialItems);
    setLoading(false);
  }, [initialFilter, initialItems]);

  const loadList = useCallback(
    async (nextFilter: RemarketingFilter) => {
      setFilter(nextFilter);
      setLoading(true);
      try {
        const nextItems = await listRemarketing({ data: { filter: nextFilter } });
        setItems(nextItems);
        void navigate({
          to: "/app/remarketing",
          search: { filter: nextFilter },
          replace: true,
        });
      } finally {
        setLoading(false);
      }
    },
    [listRemarketing, navigate],
  );

  const productMeta = (productId: string) => {
    const product = settings.products.find((item) => item.id === productId);
    return {
      label: product?.name.trim() || productId,
      color: product?.color ?? "#64748b",
    };
  };

  const statusLabel = (statusId: string) => resolveAttendanceStatusLabel(statusId, settings);
  const statusColor = (statusId: string) => resolveAttendanceStatusColor(statusId, settings);

  const openAction = (client: ClientListItem, action: ClientActionKind) => {
    const row = items.find((item) => item.id === client.id) ?? {
      ...client,
      contactDate: "",
    };
    setActionClient(row);
    setActionKind(action);
  };

  const closeAction = useCallback(() => {
    setActionClient(null);
    setActionKind(null);
  }, []);

  const patchClient = useCallback((clientId: string, patch: Partial<RemarketingListItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === clientId ? { ...item, ...patch } : item)),
    );
    setActionClient((current) =>
      current?.id === clientId ? { ...current, ...patch } : current,
    );
  }, []);

  return (
    <>
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Megaphone className="size-5" />
            <span className="text-sm font-medium">Comercial</span>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Remarketing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Clientes com data de contato na sua agenda, filtrados pelo período escolhido.
          </p>
        </div>

        <Card className="border-border/60 shadow-soft">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="font-display text-base">Fila de remarketing</CardTitle>
                <CardDescription>
                  {loading
                    ? "Atualizando lista…"
                    : `${items.length.toLocaleString("pt-BR")} cliente(s) · ${filterRangeHint(filter)}`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((option) => {
                  const active = option.id === filter;
                  return (
                    <Button
                      key={option.id}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className={cn(active && "shadow-sm")}
                      disabled={loading}
                      onClick={() => void loadList(option.id)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Carregando remarketing…
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 px-6 py-10 text-center text-sm text-muted-foreground">
                {emptyMessage(filter)}
              </div>
            ) : (
              <ClientsDataTable
                items={items}
                productMeta={productMeta}
                statusLabel={statusLabel}
                statusColor={statusColor}
                onAction={openAction}
                dimmed={loading}
                showContactDate
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
