import { createFileRoute } from "@tanstack/react-router";
import { Settings2, Shield, Package, Landmark, ListChecks } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCategoriesSettings } from "@/components/settings/user-categories-settings";
import { ProductsSettings } from "@/components/settings/products-settings";
import { AttendanceStatusesSettings } from "@/components/settings/attendance-statuses-settings";
import { BanksSettings } from "@/components/settings/banks-settings";
import { useSystemSettings } from "@/hooks/use-system-settings";

export const Route = createFileRoute("/app/configuracoes")({
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
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
          Categorias de usuários, produtos, bancos, status de atendimento e regras de cadastro.
        </p>
      </div>

      <Tabs defaultValue="categorias" className="space-y-6">
        <TabsList>
          <TabsTrigger value="categorias" className="gap-2">
            <Shield className="size-4" /> Categorias de usuário
          </TabsTrigger>
          <TabsTrigger value="produtos" className="gap-2">
            <Package className="size-4" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="bancos" className="gap-2">
            <Landmark className="size-4" /> Bancos
          </TabsTrigger>
          <TabsTrigger value="status-atendimento" className="gap-2">
            <ListChecks className="size-4" /> Status de atendimento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categorias">
          <UserCategoriesSettings
            settings={settings}
            onChange={(next) => setSettings(next, "categories")}
          />
        </TabsContent>

        <TabsContent value="produtos">
          <ProductsSettings
            settings={settings}
            onChange={(next) => setSettings(next, "products")}
          />
        </TabsContent>

        <TabsContent value="bancos">
          <BanksSettings
            settings={settings}
            onChange={(next) => {
              void setSettings(next, "banks");
            }}
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
      </Tabs>
    </div>
  );
}
