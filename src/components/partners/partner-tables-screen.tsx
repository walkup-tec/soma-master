import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currencyDigits, maskCurrencyBrl } from "@/lib/masks/br-currency";
import { PARTNER_CATEGORIES } from "@/lib/partners/partner.constants";
import {
  deletePartnerCommissionTableFn,
  listPartnerCommissionTablesFn,
  listPartnerProductBankRowsForTablesFn,
  listPartnersForTablesFn,
  upsertPartnerCommissionTableFn,
} from "@/lib/partners/partner-catalog.server";
import type {
  PartnerCommissionTable,
  PartnerProductBankRow,
} from "@/lib/partners/partner-catalog.types";

type PartnerOption = { id: string; name: string; category: string };

type Props = {
  initialRows: PartnerProductBankRow[];
  initialTables: PartnerCommissionTable[];
  initialPartners: PartnerOption[];
};

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatFlatRepasse(table: PartnerCommissionTable): { flat: string; repasse: string } {
  if (table.fixedValueEnabled) {
    const value = formatMoney(table.fixedValueCents ?? table.flatCents ?? 0);
    return { flat: value, repasse: value };
  }
  return {
    flat: `${table.flatPercent}%`,
    repasse: `${table.repassePercent}%`,
  };
}

export function PartnerTablesScreen({ initialRows, initialTables, initialPartners }: Props) {
  const listRows = useServerFn(listPartnerProductBankRowsForTablesFn);
  const listTables = useServerFn(listPartnerCommissionTablesFn);
  const listPartners = useServerFn(listPartnersForTablesFn);
  const upsertTable = useServerFn(upsertPartnerCommissionTableFn);
  const deleteTable = useServerFn(deletePartnerCommissionTableFn);

  const [rows, setRows] = useState(initialRows);
  const [tables, setTables] = useState(initialTables);
  const [partners, setPartners] = useState(initialPartners);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PartnerCommissionTable | null>(null);
  const [contextRow, setContextRow] = useState<PartnerProductBankRow | null>(null);

  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [partnerCategory, setPartnerCategory] = useState("atendente");
  const [partnerUserIds, setPartnerUserIds] = useState<string[]>([]);
  const [fixedValueEnabled, setFixedValueEnabled] = useState(false);
  const [fixedMasked, setFixedMasked] = useState("");
  const [flatPercent, setFlatPercent] = useState("0");
  const [repassePercent, setRepassePercent] = useState("0");
  const [rangeMinMasked, setRangeMinMasked] = useState("");
  const [rangeMaxMasked, setRangeMaxMasked] = useState("");

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);
  useEffect(() => {
    setTables(initialTables);
  }, [initialTables]);
  useEffect(() => {
    setPartners(initialPartners);
  }, [initialPartners]);

  const productBankOptions = useMemo(
    () => rows.filter((row) => row.bankId),
    [rows],
  );

  const resetForm = (row?: PartnerProductBankRow | null, table?: PartnerCommissionTable | null) => {
    setEditing(table ?? null);
    setContextRow(row ?? null);
    setName(table?.name ?? "");
    setIsDefault(table?.isDefault ?? false);
    setPartnerCategory(table?.partnerCategory || "atendente");
    setPartnerUserIds(table?.partnerUserIds ?? []);
    setFixedValueEnabled(table?.fixedValueEnabled ?? false);
    setFixedMasked(
      table?.fixedValueEnabled ? maskCurrencyBrl(String(table.fixedValueCents ?? 0)) : "",
    );
    setFlatPercent(String(table?.flatPercent ?? 0));
    setRepassePercent(String(table?.repassePercent ?? 0));
    setRangeMinMasked(table ? maskCurrencyBrl(String(table.rangeMinCents)) : "");
    setRangeMaxMasked(table ? maskCurrencyBrl(String(table.rangeMaxCents)) : "");
  };

  const openCreate = (row: PartnerProductBankRow) => {
    if (!row.bankId) {
      toast.error("Vincule um banco ao produto antes de criar tabela.");
      return;
    }
    resetForm(row, null);
    setModalOpen(true);
    void listPartners()
      .then(setPartners)
      .catch(() => undefined);
  };

  const openEdit = (table: PartnerCommissionTable) => {
    const row =
      rows.find((r) => r.productId === table.productId && r.bankId === table.bankId) ?? null;
    resetForm(row, table);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!contextRow?.bankId && !editing) {
      toast.error("Produto/banco inválidos.");
      return;
    }
    const productId = editing?.productId || contextRow!.productId;
    const bankId = editing?.bankId || contextRow!.bankId;
    setSaving(true);
    try {
      const next = await upsertTable({
        data: {
          id: editing?.id,
          name,
          productId,
          bankId,
          isDefault,
          partnerCategory: isDefault ? partnerCategory : null,
          partnerUserIds: isDefault ? [] : partnerUserIds,
          fixedValueEnabled,
          fixedValueCents: fixedValueEnabled ? Number(currencyDigits(fixedMasked) || 0) : null,
          flatPercent: Number(flatPercent || 0),
          repassePercent: Number(repassePercent || 0),
          rangeMinCents: Number(currencyDigits(rangeMinMasked) || 0),
          rangeMaxCents: Number(currencyDigits(rangeMaxMasked) || 0),
        },
      });
      setTables(next);
      setRows(await listRows());
      setModalOpen(false);
      toast.success(editing ? "Tabela atualizada." : "Tabela criada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a tabela.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      setTables(await deleteTable({ data: { tableId: deleteId } }));
      setRows(await listRows());
      setDeleteId(null);
      toast.success("Tabela excluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="font-display text-base">Tabelas de comissão</CardTitle>
          <CardDescription>
            Uma linha por produto × banco. Pais definem o repasse para os filhos — o Repasse do pai
            vira o Flat do filho.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Banco</th>
                  <th className="px-4 py-3 font-medium text-right">Adicionar</th>
                </tr>
              </thead>
              <tbody>
                {productBankOptions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-sm text-muted-foreground">
                      Nenhum produto×banco disponível. Configure em Parceiros → Produtos / Bancos.
                    </td>
                  </tr>
                ) : (
                  productBankOptions.map((row) => (
                    <tr key={row.key} className="border-t border-border/60">
                      <td className="px-4 py-3 font-medium">{row.productName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.bankName}</td>
                      <td className="px-4 py-3 text-right">
                        <Button type="button" size="sm" variant="outline" onClick={() => openCreate(row)}>
                          <Plus className="size-3.5" /> Criar Tabela
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Tabelas cadastradas</h3>
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Banco</th>
                    <th className="px-3 py-3 font-medium">Tabela</th>
                    <th className="px-3 py-3 font-medium">Valor inicial</th>
                    <th className="px-3 py-3 font-medium">Valor final</th>
                    <th className="px-3 py-3 font-medium">Flat</th>
                    <th className="px-3 py-3 font-medium">Repasse</th>
                    <th className="px-3 py-3 font-medium">Padrão</th>
                    <th className="px-3 py-3 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-sm text-muted-foreground">
                        Nenhuma tabela criada ainda.
                      </td>
                    </tr>
                  ) : (
                    tables.map((table) => {
                      const fr = formatFlatRepasse(table);
                      return (
                        <tr key={table.id} className="border-t border-border/60">
                          <td className="px-3 py-3">{table.bankName}</td>
                          <td className="px-3 py-3 font-medium">{table.name}</td>
                          <td className="px-3 py-3">{formatMoney(table.rangeMinCents)}</td>
                          <td className="px-3 py-3">{formatMoney(table.rangeMaxCents)}</td>
                          <td className="px-3 py-3">{fr.flat}</td>
                          <td className="px-3 py-3">{fr.repasse}</td>
                          <td className="px-3 py-3">{table.isDefault ? "Sim" : "Não"}</td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => openEdit(table)}
                                title="Editar"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => setDeleteId(table.id)}
                                title="Excluir"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tabela" : "Criar tabela"}</DialogTitle>
            <DialogDescription>
              {contextRow
                ? `${contextRow.productName} · ${contextRow.bankName}`
                : editing
                  ? `${editing.productName} · ${editing.bankName}`
                  : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="table-name">Nome da tabela</Label>
              <Input id="table-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
              <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(v === true)} />
              <span className="text-sm font-medium">Tabela padrão</span>
            </label>

            {isDefault ? (
              <div className="space-y-2">
                <Label>Categoria de parceiros</Label>
                <Select value={partnerCategory} onValueChange={setPartnerCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTNER_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Parceiros</Label>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border/60 p-2">
                  {partners.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum parceiro ativo.</p>
                  ) : (
                    partners.map((partner) => {
                      const checked = partnerUserIds.includes(partner.id);
                      return (
                        <label key={partner.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setPartnerUserIds((current) =>
                                v === true
                                  ? [...new Set([...current, partner.id])]
                                  : current.filter((id) => id !== partner.id),
                              );
                            }}
                          />
                          {partner.name}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <label className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
              <Checkbox
                checked={fixedValueEnabled}
                onCheckedChange={(v) => setFixedValueEnabled(v === true)}
              />
              <span className="text-sm font-medium">Valor fixo</span>
            </label>

            {fixedValueEnabled ? (
              <div className="space-y-2">
                <Label>Valor (Flat e Repasse)</Label>
                <Input
                  value={fixedMasked}
                  onChange={(e) => setFixedMasked(maskCurrencyBrl(e.target.value))}
                  placeholder="R$ 0,00"
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Flat (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={flatPercent}
                    onChange={(e) => setFlatPercent(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Repasse (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={repassePercent}
                    onChange={(e) => setRepassePercent(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Faixa — valor mínimo</Label>
                <Input
                  value={rangeMinMasked}
                  onChange={(e) => setRangeMinMasked(maskCurrencyBrl(e.target.value))}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Faixa — valor máximo</Label>
                <Input
                  value={rangeMaxMasked}
                  onChange={(e) => setRangeMaxMasked(maskCurrencyBrl(e.target.value))}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Faixas podem se sobrepor, mas não podem ter o mesmo mínimo e máximo de outra tabela do
              mesmo produto/banco.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tabela?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
