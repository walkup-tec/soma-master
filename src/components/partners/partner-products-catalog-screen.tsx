import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_STATUS_COLOR, normalizeStatusColor } from "@/lib/config/status-colors";
import {
  createPartnerOnlyProductFn,
  listPartnerProductBankRowsFn,
  listPartnerVisibleBanksFn,
} from "@/lib/partners/partner-catalog.server";
import type {
  PartnerProductBankRow,
  PartnerVisibleBankRow,
} from "@/lib/partners/partner-catalog.types";

type Props = {
  initialRows: PartnerProductBankRow[];
  initialBanks: PartnerVisibleBankRow[];
};

export function PartnerProductsCatalogScreen({ initialRows, initialBanks }: Props) {
  const listRows = useServerFn(listPartnerProductBankRowsFn);
  const listBanks = useServerFn(listPartnerVisibleBanksFn);
  const createProduct = useServerFn(createPartnerOnlyProductFn);
  const [rows, setRows] = useState(initialRows);
  const [banks, setBanks] = useState(initialBanks);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_STATUS_COLOR);
  const [bankIds, setBankIds] = useState<string[]>([]);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);
  useEffect(() => {
    setBanks(initialBanks);
  }, [initialBanks]);

  const bankOptions = useMemo(() => {
    const visible = banks.filter((b) => b.visible);
    return visible.length ? visible : banks;
  }, [banks]);

  const openCreate = async () => {
    setName("");
    setColor(DEFAULT_STATUS_COLOR);
    setBankIds([]);
    setOpen(true);
    try {
      setBanks(await listBanks());
    } catch {
      /* keep */
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const next = await createProduct({
        data: { name, color: normalizeStatusColor(color, DEFAULT_STATUS_COLOR), bankIds },
      });
      setRows(next);
      setOpen(false);
      toast.success("Produto criado (somente parceiros).");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o produto.");
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    try {
      setRows(await listRows());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar lista.");
    }
  };

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
            <Button type="button" variant="outline" onClick={() => void refresh()}>
              Atualizar
            </Button>
            <Button type="button" onClick={() => void openCreate()}>
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
                    <th className="px-4 py-3 font-medium">Tabela</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-t border-border/60">
                      <td className="px-4 py-3 font-medium">
                        {row.productName}
                        {row.partnerOnly ? (
                          <span className="ml-2 text-xs text-muted-foreground">(só parceiros)</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.bankName}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.tableNames.length ? row.tableNames.join(", ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo produto (parceiros)</DialogTitle>
            <DialogDescription>
              Este produto só será exibido aos parceiros, não na seção Produção própria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="partner-product-name">Nome</Label>
              <Input
                id="partner-product-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Consig. privado"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner-product-color">Cor</Label>
              <input
                id="partner-product-color"
                type="color"
                value={normalizeStatusColor(color, DEFAULT_STATUS_COLOR)}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </div>
            <div className="space-y-2">
              <Label>Bancos</Label>
              {bankOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Cadastre bancos e marque-os em Parceiros → Bancos.
                </p>
              ) : (
                <div className="grid gap-2">
                  {bankOptions.map((bank) => {
                    const checked = bankIds.includes(bank.id);
                    return (
                      <label
                        key={bank.id}
                        className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            setBankIds((current) =>
                              value === true
                                ? [...new Set([...current, bank.id])]
                                : current.filter((id) => id !== bank.id),
                            );
                          }}
                        />
                        <span className="text-sm">{bank.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={saving}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
