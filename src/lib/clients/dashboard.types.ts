import type { ClientListItem } from "@/lib/clients/client.types";

export type DashboardStatusCount = {
  statusId: string;
  count: number;
};

export type DashboardSummary = {
  clientTotal: number;
  leadsToday: number;
  openLeads: number;
  concluded: number;
  lost: number;
  agendaTodayPending: number;
  agendaOverduePending: number;
  byStatus: DashboardStatusCount[];
  recentClients: ClientListItem[];
  agendaToday: ClientListItem[];
};
