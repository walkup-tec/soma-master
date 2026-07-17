import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, FileUp, Loader2, Plus, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { listClientsFn } from "@/lib/clients/clients.server";
import {
  resolveAttendanceStatusColor,
  resolveAttendanceStatusLabel,
} from "@/lib/clients/client-status";
import type {
  ClientAttendanceFilter,
  ClientBulkScope,
  ClientListItem,
  ClientScheduleFilter,
  ClientsPageResult,
} from "@/lib/clients/client.types";
import { ClientImportWizard } from "@/components/clients/client-import-wizard";
import { ClientCreateManualDialog } from "@/components/clients/client-create-manual-dialog";
import { ClientListActionLayer } from "@/components/clients/client-list-action-layer";
import { ClientBulkActionsModal } from "@/components/clients/client-bulk-actions-modal";
import { ClientsDataTable } from "@/components/clients/clients-data-table";
import type { ClientActionKind } from "@/components/clients/client-action-modals";
import { DateRangePickerField } from "@/components/ui/date-range-picker-field";
import {
  resolveRegistrationDateRange,
  type RegistrationDatePreset,
} from "@/lib/dates/local-date";
import { cn } from "@/lib/utils";

type Props = {
  initialPage: ClientsPageResult;
};

const PAGE_SIZE = 50;

type ListFilters = {
  search: string;
  productIds: string[];
  statuses: string[];
  attendance: ClientAttendanceFilter;
  schedule: ClientScheduleFilter;
  createdFrom: string;
  createdTo: string;
};

export function ClientsScreen({ initialPage }: Props) {
  const { settings } = useSystemSettings();
  const listClients = useServerFn(listClientsFn);
  const [pageState, setPageState] = useState(initialPage);
  const [searchInput, setSearchInput] = useState("");
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [attendanceFilter, setAttendanceFilter] = useState<ClientAttendanceFilter>("all");
  const [scheduleFilter, setScheduleFilter] = useState<ClientScheduleFilter>("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [registrationPreset, setRegistrationPreset] = useState<RegistrationDatePreset>("all");
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allFilteredSelected, setAllFilteredSelected] = useState(false);
  const [actionClient, setActionClient] = useState<ClientListItem | null>(null);
  const [actionKind, setActionKind] = useState<ClientActionKind | null>(null);
  const skipInitialSearchFetch = useRef(true);
  const requestIdRef = useRef(0);
  const filtersRef = useRef<ListFilters>({
    search: "",
    productIds: [],
    statuses: [],
    attendance: "all",
    schedule: "all",
    createdFrom: "",
    createdTo: "",
  });

  const loadPage = useCallback(
    async (page: number, filters: ListFilters) => {
      filtersRef.current = filters;
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const next = await listClients({
          data: {
            page,
            pageSize: PAGE_SIZE,
            search: filters.search,
            productIds: filters.productIds,
            statuses: filters.statuses,
            attendance: filters.attendance,
            schedule: filters.schedule,
            createdFrom: filters.createdFrom,
            createdTo: filters.createdTo,
          },
        });
        if (requestId !== requestIdRef.current) return;
        setPageState(next);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Falha ao carregar clientes:", error);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [listClients],
  );

  const searchTerm = searchInput.trim();

  useEffect(() => {
    if (skipInitialSearchFetch.current && searchTerm === "") {
      skipInitialSearchFetch.current = false;
      return;
    }
    skipInitialSearchFetch.current = false;
    setAllFilteredSelected(false);
    setSelectedIds(new Set());
    void loadPage(1, {
      search: searchTerm,
      productIds: filtersRef.current.productIds,
      statuses: filtersRef.current.statuses,
      attendance: filtersRef.current.attendance,
      schedule: filtersRef.current.schedule,
      createdFrom: filtersRef.current.createdFrom,
      createdTo: filtersRef.current.createdTo,
    });
  }, [searchTerm, loadPage]);

  const productMeta = (productId: string) => {
    const product = settings.products.find((item) => item.id === productId);
    return {
      label: product?.name.trim() || productId,
      color: product?.color ?? "#64748b",
    };
  };

  const statusLabel = (statusId: string) => resolveAttendanceStatusLabel(statusId, settings);
  const statusColor = (statusId: string) => resolveAttendanceStatusColor(statusId, settings);

  const refresh = useCallback(async () => {
    await loadPage(pageState.page, filtersRef.current);
  }, [loadPage, pageState.page]);

  const goToPage = (page: number) => {
    if (page < 1 || page > pageState.totalPages || loading) return;
    void loadPage(page, filtersRef.current);
  };

  const applyFilters = (patch: Partial<ListFilters>) => {
    const next: ListFilters = {
      search: searchTerm,
      productIds: productFilter,
      statuses: statusFilter,
      attendance: attendanceFilter,
      schedule: scheduleFilter,
      createdFrom,
      createdTo,
      ...patch,
    };
    setAllFilteredSelected(false);
    setSelectedIds(new Set());
    void loadPage(1, next);
  };

  const applyProductFilter = (productIds: string[]) => {
    setProductFilter(productIds);
    applyFilters({ productIds });
  };

  const applyStatusFilter = (statuses: string[]) => {
    setStatusFilter(statuses);
    applyFilters({ statuses });
  };

  const applyAttendanceFilter = (attendance: "with" | "without") => {
    setAttendanceFilter(attendance);
    applyFilters({ attendance });
  };

  const applyScheduleFilter = () => {
    setScheduleFilter("with");
    applyFilters({ schedule: "with" });
  };

  const applyCreatedRangeFilter = (next: { from: string; to: string }) => {
    setRegistrationPreset("custom");
    setCreatedFrom(next.from);
    setCreatedTo(next.to);
    applyFilters({ createdFrom: next.from, createdTo: next.to });
  };

  const applyRegistrationPreset = (preset: RegistrationDatePreset) => {
    setRegistrationPreset(preset);
    if (preset === "all") {
      setCreatedFrom("");
      setCreatedTo("");
      applyFilters({ createdFrom: "", createdTo: "" });
      return;
    }
    if (preset === "custom") {
      // Mantém período atual; o calendário fica visível para o usuário ajustar.
      return;
    }
    const range = resolveRegistrationDateRange(preset);
    setCreatedFrom(range.from);
    setCreatedTo(range.to);
    applyFilters({ createdFrom: range.from, createdTo: range.to });
  };

  const clearListFilters = () => {
    setProductFilter([]);
    setStatusFilter([]);
    setAttendanceFilter("all");
    setScheduleFilter("all");
    setRegistrationPreset("all");
    setCreatedFrom("");
    setCreatedTo("");
    setAllFilteredSelected(false);
    setSelectedIds(new Set());
    void loadPage(1, {
      search: searchTerm,
      productIds: [],
      statuses: [],
      attendance: "all",
      schedule: "all",
      createdFrom: "",
      createdTo: "",
    });
  };

  const openAction = (client: ClientListItem, action: ClientActionKind) => {
    setActionClient(client);
    setActionKind(action);
  };

  const closeAction = useCallback(() => {
    setActionClient(null);
    setActionKind(null);
  }, []);

  const patchClient = useCallback((clientId: string, patch: Partial<ClientListItem>) => {
    setPageState((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === clientId ? { ...item, ...patch } : item)),
    }));
    setActionClient((current) =>
      current?.id === clientId ? { ...current, ...patch } : current,
    );
  }, []);

  const { items, total, page, totalPages } = pageState;
  const hasListFilters = Boolean(
    productFilter.length > 0 ||
      statusFilter.length > 0 ||
      attendanceFilter !== "all" ||
      scheduleFilter === "with" ||
      createdFrom ||
      createdTo,
  );
  const hasActiveFilters = Boolean(searchTerm || hasListFilters);

  const selectionCount = allFilteredSelected ? total : selectedIds.size;
  const hasSelection = selectionCount > 0;

  const bulkScope: ClientBulkScope | null = useMemo(() => {
    if (!hasSelection) return null;
    if (allFilteredSelected) {
      return {
        mode: "filter",
        filters: {
          search: searchTerm,
          productIds: productFilter,
          statuses: statusFilter,
          attendance: attendanceFilter,
          schedule: scheduleFilter,
          createdFrom,
          createdTo,
        },
      };
    }
    return { mode: "ids", clientIds: [...selectedIds] };
  }, [
    hasSelection,
    allFilteredSelected,
    searchTerm,
    productFilter,
    statusFilter,
    attendanceFilter,
    scheduleFilter,
    createdFrom,
    createdTo,
    selectedIds,
  ]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Users className="size-5" />
              <span className="text-sm font-medium">Operação</span>
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Clientes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre manualmente ou importe planilhas Excel com distribuição de leads.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Novo cliente
            </Button>
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp className="size-4" /> Importar
            </Button>
          </div>
        </div>

        <Card className="border-border/60 shadow-soft">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="font-display text-base">Clientes</CardTitle>
                <CardDescription>
                  {total === 0
                    ? "Nenhum cliente ainda. Use Novo cliente ou Importar."
                    : `${total.toLocaleString("pt-BR")} registro(s) no total · página ${page.toLocaleString("pt-BR")} de ${totalPages.toLocaleString("pt-BR")}`}
                </CardDescription>
              </div>
              <div className="relative w-full lg:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Buscar por nome, CPF ou telefone"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <MultiSelectFilter
                allLabel="Todos os produtos"
                values={productFilter}
                disabled={loading}
                onChange={applyProductFilter}
                options={settings.products.map((product) => ({
                  value: product.id,
                  label: product.name,
                }))}
              />

              <MultiSelectFilter
                allLabel="Todos os status"
                values={statusFilter}
                disabled={loading}
                onChange={applyStatusFilter}
                options={settings.attendanceStatuses.map((status) => ({
                  value: status.id,
                  label: status.label,
                }))}
              />

              <Select
                value={registrationPreset}
                onValueChange={(value) =>
                  applyRegistrationPreset(value as RegistrationDatePreset)
                }
              >
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Data do Registro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as datas</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="yesterday">Ontem</SelectItem>
                  <SelectItem value="week">Última Semana</SelectItem>
                  <SelectItem value="15">Últimos 15 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="custom">Personalizada</SelectItem>
                </SelectContent>
              </Select>

              {registrationPreset === "custom" ? (
                <DateRangePickerField
                  className="w-full sm:w-auto"
                  from={createdFrom}
                  to={createdTo}
                  disabled={loading}
                  placeholder="Período do registro"
                  onChange={applyCreatedRangeFilter}
                />
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={attendanceFilter === "without" ? "default" : "outline"}
                  className={cn(
                    attendanceFilter === "without" &&
                      "bg-login-brand hover:bg-login-brand/90 text-primary-foreground",
                  )}
                  disabled={loading}
                  onClick={() => applyAttendanceFilter("without")}
                >
                  Sem atendimento
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={attendanceFilter === "with" ? "default" : "outline"}
                  disabled={loading}
                  onClick={() => applyAttendanceFilter("with")}
                >
                  Com atendimento
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={scheduleFilter === "with" ? "default" : "outline"}
                  disabled={loading}
                  onClick={applyScheduleFilter}
                >
                  Com agenda
                </Button>
              </div>

              {hasListFilters ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={loading}
                  onClick={clearListFilters}
                >
                  <X className="size-4" />
                  Limpar filtros
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={allFilteredSelected ? "default" : "outline"}
                disabled={loading || total === 0}
                onClick={() => {
                  setAllFilteredSelected(true);
                  setSelectedIds(new Set());
                }}
              >
                Seleção Filtro
              </Button>
              {hasSelection ? (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectionCount.toLocaleString("pt-BR")} selecionado(s)
                    {allFilteredSelected ? " (filtro)" : ""}
                  </span>
                  <Button type="button" size="sm" onClick={() => setBulkOpen(true)}>
                    Ações
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAllFilteredSelected(false);
                      setSelectedIds(new Set());
                    }}
                  >
                    Limpar seleção
                  </Button>
                </>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Carregando clientes…
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 px-6 py-10 text-center text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Nenhum cliente encontrado para os filtros aplicados."
                  : "Crie um cliente manualmente ou importe uma planilha Excel."}
              </div>
            ) : (
              <div className="space-y-4">
                <ClientsDataTable
                  items={items}
                  productMeta={productMeta}
                  statusLabel={statusLabel}
                  statusColor={statusColor}
                  onAction={openAction}
                  dimmed={loading}
                  selectedIds={selectedIds}
                  allFilteredSelected={allFilteredSelected}
                  onToggleRow={(clientId, checked) => {
                    setAllFilteredSelected(false);
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (checked) next.add(clientId);
                      else next.delete(clientId);
                      return next;
                    });
                  }}
                  onTogglePage={(checked) => {
                    setAllFilteredSelected(false);
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      for (const item of items) {
                        if (checked) next.add(item.id);
                        else next.delete(item.id);
                      }
                      return next;
                    });
                  }}
                />

                {totalPages > 1 ? (
                  <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {(page - 1) * PAGE_SIZE + 1}–
                      {Math.min(page * PAGE_SIZE, total).toLocaleString("pt-BR")} de{" "}
                      {total.toLocaleString("pt-BR")}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page <= 1 || loading}
                        onClick={() => goToPage(page - 1)}
                      >
                        <ChevronLeft className="size-4" />
                        Anterior
                      </Button>
                      <span className="min-w-24 text-center text-sm text-muted-foreground">
                        {loading ? (
                          <Loader2 className="mx-auto size-4 animate-spin" />
                        ) : (
                          `Página ${page}`
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages || loading}
                        onClick={() => goToPage(page + 1)}
                      >
                        Próxima
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ClientCreateManualDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void refresh()}
      />

      <ClientImportWizard
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void refresh()}
      />

      <ClientListActionLayer
        actionClient={actionClient}
        actionKind={actionKind}
        onClose={closeAction}
        onClientPatch={patchClient}
      />

      <ClientBulkActionsModal
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        scope={bulkScope}
        selectionLabel={
          allFilteredSelected ? "Seleção Filtro (todos os registros filtrados)" : "Seleção da página"
        }
        onCompleted={() => {
          setAllFilteredSelected(false);
          setSelectedIds(new Set());
          void refresh();
        }}
      />
    </>
  );
}
