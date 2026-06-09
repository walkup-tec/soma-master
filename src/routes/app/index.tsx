import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import {
  AGENDA,
  ATENDENTES,
  BANCOS,
  CLIENTES,
  PRODUTOS,
  atendenteNome,
  clientePorId,
  moeda,
} from "@/mocks/data";
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Megaphone,
  TrendingUp,
  DollarSign,
  Target,
  ChevronRight,
  Phone,
  CalendarClock,
  Star,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

const conversaoSerie = [
  { mes: "Jan", leads: 220, aprovadas: 78 },
  { mes: "Fev", leads: 260, aprovadas: 96 },
  { mes: "Mar", leads: 240, aprovadas: 88 },
  { mes: "Abr", leads: 310, aprovadas: 120 },
  { mes: "Mai", leads: 350, aprovadas: 142 },
  { mes: "Jun", leads: 410, aprovadas: 178 },
];

const produtoSerie = PRODUTOS.map((p, i) => ({
  produto: p.split(" ")[0],
  conversao: 18 + ((i * 7) % 32),
}));

const atendenteSerie = ATENDENTES.map((a, i) => ({
  nome: a.nome.split(" ")[0],
  vendas: 12 + i * 5 + (i % 2) * 3,
}));

const origemSerie = [
  { name: "Facebook", value: 38 },
  { name: "Google", value: 27 },
  { name: "WhatsApp", value: 18 },
  { name: "Indicação", value: 11 },
  { name: "Site", value: 6 },
];

const bancoSerie = BANCOS.slice(0, 6).map((b, i) => ({
  banco: b.replace(" Consig", "").replace(" Consignado", ""),
  aprov: 40 + ((i * 11) % 50),
}));

const COLORS = ["#2b5330", "#76b43c", "#4a8acb", "#d2a657", "#9b6dd0"];

function Dashboard() {
  const ultimosLeads = CLIENTES.slice(0, 6);
  const hoje = new Date().toDateString();
  const agendaHoje = AGENDA.filter((a) => new Date(a.data).toDateString() === hoje).slice(0, 5);
  const followUps = AGENDA.filter((a) => !a.concluido && a.tipo === "follow_up").slice(0, 4);
  const prioritarios = CLIENTES.filter((c) => c.score >= 750).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Leads do dia" value="42" delta={12} icon={Users} tone="primary" />
        <KpiCard label="Propostas aprovadas" value="128" delta={8} icon={CheckCircle2} tone="success" />
        <KpiCard label="Pendentes" value="64" delta={-3} icon={Clock} tone="warning" />
        <KpiCard label="Reprovadas" value="21" delta={-15} icon={XCircle} tone="danger" />
        <KpiCard label="Em remarketing" value="312" delta={5} icon={Megaphone} tone="accent" />
        <KpiCard label="Conversão do mês" value="34,2%" delta={4} icon={TrendingUp} tone="primary" />
        <KpiCard label="ROI" value="3.8×" delta={2} icon={Target} tone="accent" hint="Meta 4×" />
        <KpiCard label="Ticket médio" value={moeda(18420)} delta={6} icon={DollarSign} tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 shadow-soft">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display text-base">Conversão de leads</CardTitle>
              <p className="text-xs text-muted-foreground">Leads recebidos × propostas aprovadas</p>
            </div>
            <Button size="sm" variant="outline">Últimos 6 meses</Button>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={conversaoSerie}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#76b43c" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#76b43c" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2b5330" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#2b5330" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 130)" />
                  <XAxis dataKey="mes" stroke="oklch(0.5 0.03 150)" fontSize={12} />
                  <YAxis stroke="oklch(0.5 0.03 150)" fontSize={12} />
                  <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.9 0.03 130)" }} />
                  <Area type="monotone" dataKey="leads" stroke="#76b43c" fill="url(#g1)" strokeWidth={2} />
                  <Area type="monotone" dataKey="aprovadas" stroke="#2b5330" fill="url(#g2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-base">Leads por origem</CardTitle>
            <p className="text-xs text-muted-foreground">Distribuição do mês</p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={origemSerie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {origemSerie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-base">Conversão por produto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={produtoSerie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 130)" />
                  <XAxis dataKey="produto" stroke="oklch(0.5 0.03 150)" fontSize={11} />
                  <YAxis stroke="oklch(0.5 0.03 150)" fontSize={11} />
                  <RTooltip contentStyle={{ borderRadius: 12 }} />
                  <Bar dataKey="conversao" fill="#76b43c" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-base">Vendas por atendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={atendenteSerie} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 130)" />
                  <XAxis type="number" stroke="oklch(0.5 0.03 150)" fontSize={11} />
                  <YAxis type="category" dataKey="nome" stroke="oklch(0.5 0.03 150)" fontSize={11} width={70} />
                  <RTooltip contentStyle={{ borderRadius: 12 }} />
                  <Bar dataKey="vendas" fill="#2b5330" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-base">Aprovação por banco</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bancoSerie.map((b) => (
                <div key={b.banco}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{b.banco}</span>
                    <span className="text-muted-foreground">{b.aprov}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${b.aprov}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 shadow-soft">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-display text-base">Últimos leads</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/app/clientes">Ver todos <ChevronRight className="size-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/40">
                  <tr>
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-5 py-3 font-medium">Produto</th>
                    <th className="px-5 py-3 font-medium">Banco</th>
                    <th className="px-5 py-3 font-medium">Valor</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimosLeads.map((c) => (
                    <tr key={c.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium">{c.nome}</div>
                        <div className="text-xs text-muted-foreground">{c.cidade}/{c.uf}</div>
                      </td>
                      <td className="px-5 py-3">{c.produto}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.banco}</td>
                      <td className="px-5 py-3 font-semibold">{moeda(c.valor)}</td>
                      <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-base flex items-center gap-2"><CalendarClock className="size-4 text-primary" /> Agenda do dia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {agendaHoje.length === 0 && <p className="text-sm text-muted-foreground">Nada agendado para hoje 🎉</p>}
              {agendaHoje.map((a) => {
                const c = clientePorId(a.clienteId);
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                      {new Date(a.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">{c?.nome} · {atendenteNome(c?.atendenteId ?? "")}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-base flex items-center gap-2"><Phone className="size-4 text-accent" /> Follow-ups pendentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {followUps.map((a) => {
                const c = clientePorId(a.clienteId);
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c?.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.titulo}</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0">Ligar</Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-base flex items-center gap-2"><Star className="size-4 text-warning" /> Clientes prioritários</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {prioritarios.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-full bg-accent/15 text-accent-foreground text-xs font-semibold">
                    {c.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">Score {c.score} · {moeda(c.valor)}</p>
                  </div>
                  <StatusBadge status={c.status} size="xs" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
