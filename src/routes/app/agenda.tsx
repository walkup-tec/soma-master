import { createFileRoute } from "@tanstack/react-router";
import { AgendaScreen } from "@/components/agenda/agenda-screen";
import { listAgendaFn } from "@/lib/clients/agenda.server";
import type { AgendaFilter } from "@/lib/clients/client.types";

type AgendaSearch = {
  filter: AgendaFilter;
  pending?: "1";
};

function parseAgendaSearch(search: Record<string, unknown>): AgendaSearch {
  const raw = typeof search.filter === "string" ? search.filter : "today";
  const filter: AgendaFilter =
    raw === "tomorrow" || raw === "all" || raw === "overdue" || raw === "today" ? raw : "today";
  const pending =
    search.pending === "1" || filter === "overdue" ? ("1" as const) : undefined;
  return { filter, pending };
}

export const Route = createFileRoute("/app/agenda")({
  validateSearch: (search: Record<string, unknown>): AgendaSearch => parseAgendaSearch(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const { filter, pending } = parseAgendaSearch(deps as Record<string, unknown>);
    const items = await listAgendaFn({
      data: { filter, pendingOnly: pending === "1" },
    });
    return { filter, pendingOnly: pending === "1", items };
  },
  staleTime: 15_000,
  component: AgendaPage,
});

function AgendaPage() {
  const { filter, pendingOnly, items } = Route.useLoaderData();
  return (
    <AgendaScreen initialFilter={filter} initialPendingOnly={pendingOnly} initialItems={items} />
  );
}
