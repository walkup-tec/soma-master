import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEmptyBank } from "@/lib/config/settings-defaults";
import type { BankConfig, SystemSettings } from "@/lib/config/settings-types";

type Props = {
  settings: SystemSettings;
  onChange: (settings: SystemSettings) => void;
};

export function BanksSettings({ settings, onChange }: Props) {
  const [banks, setBanks] = useState<BankConfig[]>(settings.banks ?? []);

  useEffect(() => {
    setBanks(settings.banks ?? []);
  }, [settings.banks]);

  const updateBank = (id: string, name: string) => {
    setBanks((prev) => prev.map((bank) => (bank.id === id ? { ...bank, name } : bank)));
  };

  const addBank = () => {
    setBanks((prev) => [...prev, createEmptyBank()]);
  };

  const removeBank = (id: string) => {
    setBanks((prev) => prev.filter((bank) => bank.id !== id));
  };

  const saveBanks = () => {
    const filled = banks.filter((bank) => bank.name.trim());
    if (filled.length === 0) {
      toast.error("Informe ao menos um banco com nome preenchido.");
      return;
    }
    void onChange({ ...settings, banks: filled });
    toast.success("Bancos salvos.");
  };

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader>
        <CardTitle className="font-display text-base">Bancos</CardTitle>
        <CardDescription>
          Cadastre os bancos disponíveis no campo <strong>Banco</strong> dos clientes (opcional em todos os produtos).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Cada banco é um texto livre (ex.: Itaú, Bradesco, Caixa). Nomes vazios são ignorados ao salvar.
        </div>

        <div className="space-y-3">
          {banks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum banco cadastrado. Clique em &quot;Adicionar banco&quot;.</p>
          ) : (
            banks.map((bank, index) => (
              <div key={bank.id} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`bank-${bank.id}`}>Banco {index + 1}</Label>
                  <Input
                    id={`bank-${bank.id}`}
                    value={bank.name}
                    onChange={(event) => updateBank(bank.id, event.target.value)}
                    placeholder="Nome do banco"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => removeBank(bank.id)}
                  aria-label="Remover banco"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={addBank}>
            <Plus className="size-4" /> Adicionar banco
          </Button>
          <Button type="button" onClick={saveBanks}>
            Salvar bancos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
