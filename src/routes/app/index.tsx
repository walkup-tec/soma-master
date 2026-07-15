import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Columns3,
  Users,
  XCircle,
} from "lucide-react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/clients/status-badge";
import { getDashboardSummaryFn } from "@/lib/clients/dashboard.server";
import {
  resolveAttendanceStatusColor,
  resolveAttendanceStatusLabel,
} from "@/lib/clients/client-status";
import type { DashboardSummary } from "@/lib/clients/dashboard.types";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { formatLocalDateLabel, localDateString } from "@/lib/dates/local-date";

export const Route = createFileRoute("/app/")({
  loader: async () => {
    const summary = await getDashboardSummaryFn();
    return { summary };
  },
  staleTime: 30_000,
  component: Dashboard,
});

function formatCount(value: number) {
  return value.toLocaleString("pt-BR");
}

function primaryLabel(client: { nome: string | null; cpf: string | null; telefone: string | null; id: string }) {
  return client.nome ?? client.cpf ?? client.telefone ?? client.id;
}

function Dashboard() {
  const { summary } = Route.useLoaderData() as { summary: DashboardSummary };
  const { settings } = useSystemSettings();

  const statusLabel = (statusId: string) => resolveAttendanceStatusLabel(statusId, settings);
  const statusColor = (statusId: string) => resolveAttendanceStatusColor(statusId, settings);

  const productName = (productId: string) =>
    settings.products.find((product) => product.id === productId)?.name ?? productId;

  const statusPie = summary.byStatus
    .filter((row) => row.count > 0)
    .map((row) => ({
      name: statusLabel(row.statusId),
      value: row.count,
      color: statusColor(row.statusId),
    }));
  const statusPieTotal = statusPie.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Indicadores dos seus clientes · {formatLocalDateLabel(localDateString())}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Meus clientes"
          value={formatCount(summary.clientTotal)}
          icon={Users}
          tone="primary"
          hint="Na sua carteira"
        />
        <KpiCard
          label="Leads do dia"
          value={formatCount(summary.leadsToday)}
          icon={Users}
          tone="accent"
          hint="Cadastrados hoje"
        />
        <KpiCard
          label="Em aberto"
          value={formatCount(summary.openLeads)}
          icon={Clock}
          tone="warning"
          hint="Exceto concluído/perdido"
        />
        <KpiCard
          label="Concluídos"
          value={formatCount(summary.concluded)}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Perdidos"
          value={formatCount(summary.lost)}
          icon={XCircle}
          tone="danger"
        />
        <KpiCard
          label="Agenda hoje"
          value={formatCount(summary.agendaTodayPending)}
          icon={CalendarDays}
          tone="accent"
          hint="Contatos pendentes"
        />
        <KpiCard
          label="Agenda atrasada"
          value={formatCount(summary.agendaOverduePending)}
          icon={AlertTriangle}
          tone="danger"
          hint="Antes de hoje"
        />
        <KpiCard
          label="Em atendimento"
          value={formatCount(
            summary.byStatus.find((row) => row.statusId === "em_atendimento")?.count ?? 0,
          )}
          icon={Columns3}
          tone="primary"
          hint="Status em atendimento"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 shadow-soft lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="font-display text-base">Últimos clientes</CardTitle>
              <CardDescription>Mais recentes da sua carteira</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/app/clientes">
                Ver todos <ChevronRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {summary.recentClients.length === 0 ? (
              <p className="px-5 py-10 text-sm text-muted-foreground">
                Nenhum cliente na sua carteira ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Cliente</th>
                      <th className="px-5 py-3 font-medium">Produto</th>
                      <th className="px-5 py-3 font-medium">Telefone</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentClients.map((client) => (
                      <tr
                        key={client.id}
                        className="border-t border-border/60 transition-colors hover:bg-muted/30"
                      >
                        <td className="px-5 py-3 font-medium">{primaryLabel(client)}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {productName(client.productId)}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {client.telefone ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge
                            label={statusLabel(client.status)}
                            color={statusColor(client.status)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-base">Por status</CardTitle>
            <CardDescription>Distribuição da sua carteira</CardDescription>
          </CardHeader>
          <CardContent>
            {statusPie.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {statusPie.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <RTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const item = payload[0].payload as {
                          name: string;
                          value: number;
                        };
                        const percent =
                          statusPieTotal > 0 ? (item.value / statusPieTotal) * 100 : 0;
                        return (
                          <div className="rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-[11px] shadow-md">
                            <p className="font-medium leading-tight">{item.name}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {formatCount(item.value)} ·{" "}
                              {percent.toLocaleString("pt-BR", {
                                maximumFractionDigits: 1,
                                minimumFractionDigits: 0,
                              })}
                              %
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 shadow-soft">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-display flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-primary" />
              Agenda do dia
            </CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/app/agenda" search={{ filter: "today", pending: "1" }}>
                Abrir agenda <ChevronRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.agendaToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contato pendente para hoje.</p>
            ) : (
              summary.agendaToday.map((client) => (
                <div key={client.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{primaryLabel(client)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {client.telefone ?? productName(client.productId)}
                    </p>
                  </div>
                  <StatusBadge
                    label={statusLabel(client.status)}
                    color={statusColor(client.status)}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-soft">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-display text-base">Atalhos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/clientes">Clientes</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/agenda" search={{ filter: "today" }}>
                Agenda
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/kanban" search={{ view: "status" }}>
                Kanban
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/remarketing" search={{ filter: "today" }}>
                Remarketing
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
