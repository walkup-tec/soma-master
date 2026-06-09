import { createFileRoute } from "@tanstack/react-router";
import { Settings2, Shield, Package } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { UserCategoriesSettings } from "@/components/settings/user-categories-settings";
import { ProductsSettings } from "@/components/settings/products-settings";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/config/settings-defaults";

export const Route = createFileRoute("/app/configuracoes")({
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { settings, setSettings } = useSystemSettings();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Settings2 className="size-5" />
            <span className="text-sm font-medium">Administração</span>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Configurações</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Categorias de usuários, permissões de menu e regras de cadastro por produto.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSettings(DEFAULT_SYSTEM_SETTINGS);
            toast.success("Configurações restauradas para o padrão.");
          }}
        >
          Restaurar padrão
        </Button>
      </div>

      <Tabs defaultValue="categorias" className="space-y-6">
        <TabsList>
          <TabsTrigger value="categorias" className="gap-2">
            <Shield className="size-4" /> Categorias de usuário
          </TabsTrigger>
          <TabsTrigger value="produtos" className="gap-2">
            <Package className="size-4" /> Produtos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categorias">
          <UserCategoriesSettings settings={settings} onChange={setSettings} />
        </TabsContent>

        <TabsContent value="produtos">
          <ProductsSettings settings={settings} onChange={setSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
