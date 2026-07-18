import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ProductsSettings } from "@/components/settings/products-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { listPartnerProductBankRowsFn } from "@/lib/partners/partner-catalog.server";
import type { PartnerProductBankRow } from "@/lib/partners/partner-catalog.types";
import { cn } from "@/lib/utils";

type Props = {
  initialRows: PartnerProductBankRow[];
};

function OriginTag({ partnerOnly }: { partnerOnly: boolean }) {
  const label = partnerOnly ? "Parceiros" : "Produção própria";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        partnerOnly
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      )}
    >
      <Check className="size-3.5 shrink-0" strokeWidth={3} aria-hidden />
      {label}
    </span>
  );
}

export function PartnerProductsCatalogScreen({ initialRows }: Props) {
  const listRows = useServerFn(listPartnerProductBankRowsFn);
  const { settings, setSettings, loading } = useSystemSettings();
  const [rows, setRows] = useState(initialRows);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setRows(await listRows());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar lista.");
    } finally {
      setRefreshing(false);
    }
  };

  if (creating) {
    return (
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setCreating(false);
            void refresh();
          }}
        >
          <ArrowLeft className="size-4" /> Voltar à lista
        </Button>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando cadastro…</p>
        ) : (
          <ProductsSettings
            catalog="partners"
            settings={settings}
            onChange={(next) => setSettings(next, "products")}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 shadow-soft">
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="font-display text-base">Produtos para parceiros</CardTitle>
            <CardDescription>
              Exibe produtos da Produção própria marcados como &quot;Sim&quot; para parceiros e
              produtos criados só nesta seção (não aparecem em Produção própria).
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={refreshing}
              onClick={() => void refresh()}
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              Atualizar
            </Button>
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Novo produto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum produto disponível para parceiros.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Produto</th>
                    <th className="px-4 py-3 font-medium">Banco</th>
                    <th className="px-4 py-3 font-medium">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-t border-border/60">
                      <td className="px-4 py-3 font-medium">{row.productName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.bankName}</td>
                      <td className="px-4 py-3">
                        <OriginTag partnerOnly={row.partnerOnly} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
