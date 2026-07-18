import { ProductsSettings } from "@/components/settings/products-settings";
import { useSystemSettings } from "@/hooks/use-system-settings";

/** Parceiros → Produtos: mesma tela/wizard da Produção própria, com flag partnerOnly. */
export function PartnerProductsCatalogScreen() {
  const { settings, setSettings, loading } = useSystemSettings();

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Carregando produtos…</p>
    );
  }

  return (
    <ProductsSettings
      catalog="partners"
      settings={settings}
      onChange={(next) => setSettings(next, "products")}
    />
  );
}
