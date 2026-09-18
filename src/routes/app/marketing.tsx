import { createFileRoute } from "@tanstack/react-router";
import { Filter } from "lucide-react";
import { MarketingFunnelPanel } from "@/components/marketing/marketing-panels";

export const Route = createFileRoute("/app/marketing")({
  component: MarketingPage,
});

function MarketingPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Filter className="size-5" />
          <span className="text-sm font-medium">Funil</span>
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Funil</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Monte jornadas de prospecção e dispare campanhas pelo construtor.
        </p>
      </div>

      <MarketingFunnelPanel />
    </div>
  );
}
