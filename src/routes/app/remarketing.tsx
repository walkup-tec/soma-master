import { createFileRoute } from "@tanstack/react-router";
import { RemarketingScreen } from "@/components/remarketing/remarketing-screen";
import { listRemarketingFn } from "@/lib/clients/remarketing.server";
import type { RemarketingFilter } from "@/lib/clients/client.types";

type RemarketingSearch = {
  filter: RemarketingFilter;
};

function parseRemarketingSearch(search: Record<string, unknown>): RemarketingSearch {
  const raw = typeof search.filter === "string" ? search.filter : "today";
  const filter: RemarketingFilter =
    raw === "week" || raw === "next15" || raw === "next30" || raw === "today"
      ? raw
      : "today";
  return { filter };
}

export const Route = createFileRoute("/app/remarketing")({
  validateSearch: (search: Record<string, unknown>): RemarketingSearch =>
    parseRemarketingSearch(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const { filter } = parseRemarketingSearch(deps as Record<string, unknown>);
    const items = await listRemarketingFn({ data: { filter } });
    return { filter, items };
  },
  staleTime: 15_000,
  component: RemarketingPage,
});

function RemarketingPage() {
  const { filter, items } = Route.useLoaderData();
  return <RemarketingScreen initialFilter={filter} initialItems={items} />;
}
