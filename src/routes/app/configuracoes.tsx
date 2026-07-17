import { createFileRoute } from "@tanstack/react-router";
import { Settings2, Shield, Package, Landmark, ListChecks, Bot } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCategoriesSettings } from "@/components/settings/user-categories-settings";
import { ProductsSettings } from "@/components/settings/products-settings";
import { AttendanceStatusesSettings } from "@/components/settings/attendance-statuses-settings";
import { BanksSettings } from "@/components/settings/banks-settings";
import { ChatbotSettings } from "@/components/settings/chatbot-settings";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { getChatbotSettingsLoaderFn } from "@/lib/chat/chat.server";

const SETTINGS_TABS = [
  "bancos",
  "produtos",
  "categorias",
  "status-atendimento",
  "chatbot",
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number];

function parseTab(value: unknown): SettingsTabId {
  const raw = String(value ?? "bancos");
  return (SETTINGS_TABS.includes(raw as SettingsTabId) ? raw : "bancos") as SettingsTabId;
}

type SettingsSearch = {
  tab: SettingsTabId;
  ok?: string;
  err?: string;
};

export const Route = createFileRoute("/app/configuracoes")({
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    const tab = parseTab(search.tab);
    const ok = typeof search.ok === "string" && search.ok.trim() ? search.ok.trim() : undefined;
    const err = typeof search.err === "string" && search.err.trim() ? search.err.trim() : undefined;
    return { tab, ok, err };
  },
  loaderDeps: ({ search }) => ({ tab: search.tab }),
  loader: async ({ deps }) => {
    if (deps.tab !== "chatbot") {
      return { evo: null, education: null };
    }
    return getChatbotSettingsLoaderFn();
  },
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const navigate = Route.useNavigate();
  const { tab, ok, err } = Route.useSearch();
  const { evo, education } = Route.useLoaderData();
  const { settings, setSettings } = useSystemSettings();

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Settings2 className="size-5" />
          <span className="text-sm font-medium">Administração</span>
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bancos, produtos, categorias, status e Integração EVO (Chatbot).
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
          <TabsTrigger value="bancos" className="gap-2">
            <Landmark className="size-4" /> Bancos
          </TabsTrigger>
          <TabsTrigger value="produtos" className="gap-2">
            <Package className="size-4" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="categorias" className="gap-2">
            <Shield className="size-4" /> Categorias de usuário
          </TabsTrigger>
          <TabsTrigger value="status-atendimento" className="gap-2">
            <ListChecks className="size-4" /> Status de atendimento
          </TabsTrigger>
          <TabsTrigger value="chatbot" className="gap-2">
            <Bot className="size-4" /> Integração EVO
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bancos">
          <BanksSettings
            settings={settings}
            onChange={(next) => setSettings(next, "banks")}
          />
        </TabsContent>

        <TabsContent value="produtos">
          <ProductsSettings
            settings={settings}
            onChange={(next) => setSettings(next, "products")}
          />
        </TabsContent>

        <TabsContent value="categorias">
          <UserCategoriesSettings
            settings={settings}
            onChange={(next) => setSettings(next, "categories")}
          />
        </TabsContent>

        <TabsContent value="status-atendimento">
          <AttendanceStatusesSettings
            settings={settings}
            onChange={(next) => {
              void setSettings(next, "attendanceStatuses");
            }}
          />
        </TabsContent>

        <TabsContent value="chatbot">
          <ChatbotSettings evo={evo} education={education} flashOk={ok} flashErr={err} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
