import { createFileRoute } from "@tanstack/react-router";
import { Target, Phone, Filter, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MarketingApiAlternativaPanel,
  MarketingFunnelPanel,
  MarketingWhatsAppNumbersPanel,
} from "@/components/marketing/marketing-panels";

const MARKETING_TABS = ["numeros-whatsapp", "funil", "api-alternativa"] as const;

type MarketingTabId = (typeof MARKETING_TABS)[number];

function parseTab(value: unknown): MarketingTabId {
  const raw = String(value ?? "numeros-whatsapp");
  return (MARKETING_TABS.includes(raw as MarketingTabId) ? raw : "numeros-whatsapp") as MarketingTabId;
}

type MarketingSearch = {
  tab: MarketingTabId;
};

export const Route = createFileRoute("/app/marketing")({
  validateSearch: (search: Record<string, unknown>): MarketingSearch => ({
    tab: parseTab(search.tab),
  }),
  component: MarketingPage,
});

function MarketingPage() {
  const navigate = Route.useNavigate();
  const { tab } = Route.useSearch();

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Target className="size-5" />
          <span className="text-sm font-medium">Marketing</span>
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Marketing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Números WhatsApp, funil e API Alternativa.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(next) => {
          void navigate({ search: { tab: parseTab(next) } });
        }}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="numeros-whatsapp" className="gap-2">
            <Phone className="size-4" /> Números WhatsApp
          </TabsTrigger>
          <TabsTrigger value="funil" className="gap-2">
            <Filter className="size-4" /> Funil
          </TabsTrigger>
          <TabsTrigger value="api-alternativa" className="gap-2">
            <Zap className="size-4" /> API Alternativa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="numeros-whatsapp">
          <MarketingWhatsAppNumbersPanel />
        </TabsContent>
        <TabsContent value="funil">
          <MarketingFunnelPanel />
        </TabsContent>
        <TabsContent value="api-alternativa">
          <MarketingApiAlternativaPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
