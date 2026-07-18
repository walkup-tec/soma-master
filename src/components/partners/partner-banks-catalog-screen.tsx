import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listPartnerVisibleBanksFn,
  savePartnerVisibleBanksFn,
} from "@/lib/partners/partner-catalog.server";
import type { PartnerVisibleBankRow } from "@/lib/partners/partner-catalog.types";
import { cn } from "@/lib/utils";

type Props = {
  initialBanks: PartnerVisibleBankRow[];
};

export function PartnerBanksCatalogScreen({ initialBanks }: Props) {
  const listBanks = useServerFn(listPartnerVisibleBanksFn);
  const saveBanks = useServerFn(savePartnerVisibleBanksFn);
  const [banks, setBanks] = useState(initialBanks);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBanks(initialBanks);
  }, [initialBanks]);

  const toggle = (bankId: string, checked: boolean) => {
    setBanks((current) =>
      current.map((bank) => (bank.id === bankId ? { ...bank, visible: checked } : bank)),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const next = await saveBanks({
        data: { bankIds: banks.filter((b) => b.visible).map((b) => b.id) },
      });
      setBanks(next);
      toast.success("Bancos visíveis aos parceiros atualizados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
      try {
        setBanks(await listBanks());
      } catch {
        /* ignore */
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader>
        <CardTitle className="font-display text-base">Bancos para parceiros</CardTitle>
        <CardDescription>
          Bancos cadastrados em Produção própria → Configurações → Bancos. Marque os que devem
          aparecer para o parceiro quando ele acessar o sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {banks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum banco cadastrado na Produção própria. Cadastre em Configurações → Bancos.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {banks.map((bank) => (
              <label
                key={bank.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 p-3",
                  bank.visible && "border-primary/40 bg-primary/5",
                )}
              >
                <Checkbox
                  checked={bank.visible}
                  disabled={saving}
                  onCheckedChange={(value) => toggle(bank.id, value === true)}
                />
                <span className="text-sm font-medium">{bank.name}</span>
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button type="button" onClick={() => void handleSave()} disabled={saving || banks.length === 0}>
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
