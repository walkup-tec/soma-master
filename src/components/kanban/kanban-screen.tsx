import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Columns3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientListActionLayer } from "@/components/clients/client-list-action-layer";
import { StatusBadge } from "@/components/clients/status-badge";
import type { ClientActionKind } from "@/components/clients/client-action-modals";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { listKanbanFn } from "@/lib/clients/kanban.server";
import {
  buildKanbanColumns,
  buildKanbanMonthWeeks,
  countKanbanMonthCards,
  filterKanbanItemsByPeriod,
  filterKanbanItemsByStatuses,
  layoutKanbanStatusGrid,
  resolveKanbanPeriodRange,
  type KanbanColumn,
  type KanbanDayCell,
  type KanbanPeriodPreset,
} from "@/lib/clients/kanban-board";
import {
  resolveAttendanceStatusColor,
  resolveAttendanceStatusLabel,
} from "@/lib/clients/client-status";
import type { KanbanListItem, KanbanViewMode } from "@/lib/clients/client.types";
import {
  endOfLocalWeekSunday,
  formatLocalDateLabel,
  LOCAL_WEEKDAY_HEADERS,
  localMonthBounds,
  startOfLocalWeekMonday,
} from "@/lib/dates/local-date";
import { cn } from "@/lib/utils";

type Props = {
  initialView: KanbanViewMode;
  initialItems: KanbanListItem[];
};

const VIEWS: { id: KanbanViewMode; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "weekly", label: "Semanal" },
  { id: "monthly", label: "Mensal" },
];

const PERIOD_OPTIONS: { id: KanbanPeriodPreset; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "day", label: "Dia" },
  { id: "week", label: "Semana" },
  { id: "15", label: "15 dias" },
  { id: "30", label: "30 dias" },
];

function cardTitle(client: KanbanListItem) {
  return client.nome ?? client.cpf ?? client.telefone ?? client.id;
}

function statusPeriodHint(preset: KanbanPeriodPreset) {
  if (preset === "all") return "Todos os períodos";
  const { from, to } = resolveKanbanPeriodRange(preset);
  if (from === to) return formatLocalDateLabel(from);
  return `${formatLocalDateLabel(from)} — ${formatLocalDateLabel(to)}`;
}

function viewPeriodHint(view: KanbanViewMode, period: KanbanPeriodPreset) {
  if (view === "status") return statusPeriodHint(period);
  if (view === "weekly") {
    return `${formatLocalDateLabel(startOfLocalWeekMonday())} — ${formatLocalDateLabel(endOfLocalWeekSunday())}`;
  }
  const { from, to } = localMonthBounds();
  return `${formatLocalDateLabel(from)} — ${formatLocalDateLabel(to)}`;
}

function ClientCard({
  client,
  compact,
  showStatus,
  statusLabel,
  statusColor,
  onOpen,
}: {
  client: KanbanListItem;
  compact?: boolean;
  showStatus: boolean;
  statusLabel: (id: string) => string;
  statusColor: (id: string) => string;
  onOpen: (client: KanbanListItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(client)}
      className={cn(
        "w-full rounded-lg border border-border/60 bg-background text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "px-1.5 py-1 sm:px-2 sm:py-1.5" : "px-3 py-2.5",
      )}
    >
      <p className={cn("truncate font-medium", compact ? "text-[10px] sm:text-[11px]" : "text-sm")}>
        {cardTitle(client)}
      </p>
      {client.telefone && !compact ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{client.telefone}</p>
      ) : null}
      {showStatus ? (
        <div className={cn("mt-1", compact && "origin-left scale-[0.85]")}>
          <StatusBadge label={statusLabel(client.status)} color={statusColor(client.status)} />
        </div>
      ) : null}
    </button>
  );
}

function DayColumn({
  column,
  compact,
  fillParent,
  showStatus,
  statusLabel,
  statusColor,
  onOpen,
}: {
  column: KanbanColumn;
  compact?: boolean;
  fillParent?: boolean;
  showStatus: boolean;
  statusLabel: (id: string) => string;
  statusColor: (id: string) => string;
  onOpen: (client: KanbanListItem) => void;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-border/60 bg-muted/20",
        fillParent ? "h-full min-h-0 w-full" : compact ? "w-full" : "w-[260px] shrink-0",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center gap-1.5 border-b border-border/50 py-2",
          compact || fillParent ? "px-1.5 sm:px-2" : "px-3",
        )}
      >
        {column.accentColor ? (
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: column.accentColor }}
          />
        ) : null}
        <h3
          className={cn(
            "min-w-0 flex-1 truncate font-semibold",
            compact || fillParent ? "text-[11px] sm:text-xs" : "text-sm",
          )}
        >
          {column.title}
        </h3>
        <span className="text-[10px] text-muted-foreground sm:text-xs">{column.items.length}</span>
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-col gap-1.5 overflow-y-auto p-1.5 sm:p-2",
          fillParent
            ? "flex-1"
            : compact
              ? "max-h-[min(72vh,680px)]"
              : "max-h-[min(70vh,640px)]",
        )}
      >
        {column.items.length === 0 ? (
          <p className="px-1 py-6 text-center text-[10px] text-muted-foreground sm:text-xs">—</p>
        ) : (
          column.items.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              compact={compact || fillParent}
              showStatus={showStatus}
              statusLabel={statusLabel}
              statusColor={statusColor}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MonthDayCell({
  day,
  statusLabel,
  statusColor,
  onOpen,
}: {
  day: KanbanDayCell;
  statusLabel: (id: string) => string;
  statusColor: (id: string) => string;
  onOpen: (client: KanbanListItem) => void;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col rounded-lg border border-border/50 bg-muted/15",
        !day.inMonth && "bg-muted/5 opacity-45",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/40 px-1.5 py-1">
        <span
          className={cn(
            "text-[11px] font-semibold tabular-nums",
            day.inMonth ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {day.dayLabel}
        </span>
        {day.inMonth && day.items.length > 0 ? (
          <span className="text-[10px] text-muted-foreground">{day.items.length}</span>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1">
        {day.inMonth
          ? day.items.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                compact
                showStatus
                statusLabel={statusLabel}
                statusColor={statusColor}
                onOpen={onOpen}
              />
            ))
          : null}
      </div>
    </div>
  );
}

export function KanbanScreen({ initialView, initialItems }: Props) {
  const navigate = useNavigate();
  const { settings } = useSystemSettings();
  const listKanban = useServerFn(listKanbanFn);
  const [view, setView] = useState<KanbanViewMode>(initialView);
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<KanbanPeriodPreset>("all");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [actionClient, setActionClient] = useState<KanbanListItem | null>(null);
  const [actionKind, setActionKind] = useState<ClientActionKind | null>(null);

  useEffect(() => {
    setView(initialView);
    setItems(initialItems);
    setLoading(false);
  }, [initialView, initialItems]);

  const statusOptions = useMemo(
    () =>
      settings.attendanceStatuses.map((status) => ({
        value: status.id,
        label: status.label,
      })),
    [settings.attendanceStatuses],
  );

  const filteredItems = useMemo(() => {
    if (view === "status") {
      return filterKanbanItemsByPeriod(items, period);
    }
    return filterKanbanItemsByStatuses(items, statusFilter);
  }, [view, items, period, statusFilter]);

  const columns = useMemo(
    () =>
      view === "monthly"
        ? []
        : buildKanbanColumns(view, filteredItems, settings.attendanceStatuses),
    [view, filteredItems, settings.attendanceStatuses],
  );

  const statusGrid = useMemo(
    () => (view === "status" ? layoutKanbanStatusGrid(columns.length) : null),
    [view, columns.length],
  );

  const monthWeeks = useMemo(
    () => (view === "monthly" ? buildKanbanMonthWeeks(filteredItems) : []),
    [view, filteredItems],
  );

  const visibleCount = useMemo(() => {
    if (view === "monthly") return countKanbanMonthCards(monthWeeks);
    return columns.reduce((sum, column) => sum + column.items.length, 0);
  }, [view, columns, monthWeeks]);

  const loadBoard = useCallback(
    async (nextView: KanbanViewMode) => {
      setView(nextView);
      setLoading(true);
      try {
        const nextItems = await listKanban();
        setItems(nextItems);
        void navigate({
          to: "/app/kanban",
          search: { view: nextView },
          replace: true,
        });
      } finally {
        setLoading(false);
      }
    },
    [listKanban, navigate],
  );

  const statusLabel = (statusId: string) => resolveAttendanceStatusLabel(statusId, settings);
  const statusColor = (statusId: string) => resolveAttendanceStatusColor(statusId, settings);

  const openAttendance = (client: KanbanListItem) => {
    setActionClient(client);
    setActionKind("attendance");
  };

  const closeAction = useCallback(() => {
    setActionClient(null);
    setActionKind(null);
  }, []);

  const patchClient = useCallback((clientId: string, patch: Partial<KanbanListItem>) => {
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
            <Columns3 className="size-5" />
            <span className="text-sm font-medium">Comercial</span>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Kanban</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quadro dos seus clientes. Clique no card para registrar atendimento.
          </p>
        </div>

        <Card className="border-border/60 shadow-soft">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="font-display text-base">Quadro</CardTitle>
                <CardDescription>
                  {loading
                    ? "Atualizando…"
                    : `${visibleCount.toLocaleString("pt-BR")} card(s) · ${viewPeriodHint(view, period)}`}
                  {!loading && view === "status" && statusGrid
                    ? ` · ${statusGrid.rows} linha(s) × ${statusGrid.cols} col.`
                    : null}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {VIEWS.map((option) => {
                  const active = option.id === view;
                  return (
                    <Button
                      key={option.id}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      disabled={loading}
                      onClick={() => void loadBoard(option.id)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {view === "status" ? (
              <div className="flex flex-wrap gap-2">
                {PERIOD_OPTIONS.map((option) => {
                  const active = option.id === period;
                  return (
                    <Button
                      key={option.id}
                      type="button"
                      size="sm"
                      variant={active ? "secondary" : "outline"}
                      disabled={loading}
                      onClick={() => setPeriod(option.id)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Status</span>
                <MultiSelectFilter
                  allLabel="Todos os status"
                  options={statusOptions}
                  values={statusFilter}
                  onChange={setStatusFilter}
                  disabled={loading || statusOptions.length === 0}
                  className="w-[220px]"
                />
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Carregando kanban…
              </div>
            ) : view === "monthly" ? (
              <div
                className={cn(
                  "flex h-[min(78vh,820px)] flex-col gap-1",
                  loading && "pointer-events-none opacity-60",
                )}
              >
                <div className="grid grid-cols-7 gap-1">
                  {LOCAL_WEEKDAY_HEADERS.map((label) => (
                    <div
                      key={label}
                      className="px-1 py-1 text-center text-[11px] font-semibold text-muted-foreground"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <div
                  className="grid min-h-0 flex-1 gap-1"
                  style={{
                    gridTemplateRows: `repeat(${Math.max(monthWeeks.length, 1)}, minmax(0, 1fr))`,
                  }}
                >
                  {monthWeeks.map((week) => (
                    <div key={week.id} className="grid min-h-0 grid-cols-7 gap-1">
                      {week.days.map((day) => (
                        <MonthDayCell
                          key={day.id}
                          day={day}
                          statusLabel={statusLabel}
                          statusColor={statusColor}
                          onOpen={openAttendance}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : view === "status" ? (
              columns.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Nenhum cliente no período selecionado.
                </p>
              ) : (
                <div
                  className={cn(
                    "grid h-[min(78vh,820px)] gap-2",
                    loading && "pointer-events-none opacity-60",
                  )}
                  style={{
                    gridTemplateColumns: `repeat(${statusGrid!.cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${statusGrid!.rows}, minmax(0, 1fr))`,
                  }}
                >
                  {columns.map((column) => (
                    <DayColumn
                      key={column.id}
                      column={column}
                      fillParent
                      showStatus={false}
                      statusLabel={statusLabel}
                      statusColor={statusColor}
                      onOpen={openAttendance}
                    />
                  ))}
                </div>
              )
            ) : (
              <div
                className={cn(
                  "grid h-[min(78vh,820px)] grid-cols-7 gap-2",
                  loading && "pointer-events-none opacity-60",
                )}
              >
                {columns.map((column) => (
                  <DayColumn
                    key={column.id}
                    column={column}
                    compact
                    fillParent
                    showStatus
                    statusLabel={statusLabel}
                    statusColor={statusColor}
                    onOpen={openAttendance}
                  />
                ))}
              </div>
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
