import { createFileRoute } from "@tanstack/react-router";
import { KanbanScreen } from "@/components/kanban/kanban-screen";
import { listKanbanFn } from "@/lib/clients/kanban.server";
import type { KanbanViewMode } from "@/lib/clients/client.types";

type KanbanSearch = {
  view: KanbanViewMode;
};

function parseKanbanSearch(search: Record<string, unknown>): KanbanSearch {
  const raw = typeof search.view === "string" ? search.view : "status";
  const view: KanbanViewMode =
    raw === "weekly" || raw === "monthly" || raw === "status" ? raw : "status";
  return { view };
}

export const Route = createFileRoute("/app/kanban")({
  validateSearch: (search: Record<string, unknown>): KanbanSearch => parseKanbanSearch(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const { view } = parseKanbanSearch(deps as Record<string, unknown>);
    const items = await listKanbanFn();
    return { view, items };
  },
  staleTime: 15_000,
  component: KanbanPage,
});

function KanbanPage() {
  const { view, items } = Route.useLoaderData();
  return <KanbanScreen initialView={view} initialItems={items} />;
}
