import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Copy,
  Download,
  Eye,
  FileUp,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
import { uploadBankOperationalGuideFn } from "@/lib/config/settings.server";
import { createEmptyBank, normalizeBanks } from "@/lib/config/settings-defaults";
import type { BankConfig, SystemSettings } from "@/lib/config/settings-types";
import { cn } from "@/lib/utils";

type Props = {
  settings: SystemSettings;
  onChange: (settings: SystemSettings) => Promise<SystemSettings> | void;
};

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function copyText(label: string, value: string) {
  const text = String(value || "").trim();
  if (!text) {
    toast.error(`${label} vazio.`);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado.`);
  } catch {
    toast.error(`Não foi possível copiar ${label.toLowerCase()}.`);
  }
}

function hasStormAccess(bank: BankConfig): boolean {
  return (
    bank.stormAccessEnabled &&
    Boolean(
      bank.stormUsername.trim() || bank.stormPassword.trim() || bank.stormLink.trim(),
    )
  );
}

function hasBankAccess(bank: BankConfig): boolean {
  return (
    bank.bankAccessEnabled &&
    Boolean(bank.bankUsername.trim() || bank.bankPassword.trim() || bank.bankLink.trim())
  );
}

function hasLinkAccess(bank: BankConfig): boolean {
  return Boolean(bank.stormLink.trim() || bank.bankLink.trim());
}

function hasGuideAccess(bank: BankConfig): boolean {
  return (
    bank.operationalGuideEnabled && Boolean(bank.operationalGuide?.storageId?.trim())
  );
}

function AccessCheckIcon(props: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        props.active
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          : "border-border/50 bg-muted/20 text-muted-foreground/50",
      )}
      title={props.label}
    >
      {props.active ? <Check className="size-3" /> : <X className="size-3" />}
      {props.label}
    </span>
  );
}

function CredentialField(props: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.id} className="text-xs">
        {props.label}
      </Label>
      <Input
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        autoComplete="off"
      />
    </div>
  );
}

function DetailCopyRow(props: { label: string; value: string }) {
  const value = String(props.value || "").trim();
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{props.label}</p>
        <p className="break-all text-sm">{value}</p>
      </div>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="shrink-0"
        title={`Copiar ${props.label}`}
        onClick={() => void copyText(props.label, value)}
      >
        <Copy className="size-3.5" />
      </Button>
    </div>
  );
}

export function BanksSettings({ settings, onChange }: Props) {
  const uploadGuide = useServerFn(uploadBankOperationalGuideFn);
  const [banks, setBanks] = useState<BankConfig[]>(settings.banks ?? []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BankConfig>(() => createEmptyBank());
  const [detailBank, setDetailBank] = useState<BankConfig | null>(null);

  useEffect(() => {
    setBanks(settings.banks ?? []);
  }, [settings.banks]);

  const productsByBankId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const product of settings.products ?? []) {
      for (const bankId of product.bankIds ?? []) {
        const list = map.get(bankId) ?? [];
        list.push(product.name.trim() || product.tag.trim() || "Produto");
        map.set(bankId, list);
      }
    }
    return map;
  }, [settings.products]);

  const patchDraft = (patch: Partial<BankConfig>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const openCreateForm = () => {
    setEditingId(null);
    setDraft(createEmptyBank());
    setFormOpen(true);
  };

  const openEditForm = (bank: BankConfig) => {
    setEditingId(bank.id);
    setDraft({ ...bank });
    setFormOpen(true);
    setDetailBank(null);
  };

  const cancelForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setDraft(createEmptyBank());
  };

  const removeBank = async (id: string) => {
    const next = banks.filter((bank) => bank.id !== id);
    setSaving(true);
    try {
      const result = await onChange({ ...settings, banks: normalizeBanks(next) });
      setBanks(result?.banks ?? next);
      if (detailBank?.id === id) setDetailBank(null);
      if (editingId === id) cancelForm();
      toast.success("Banco removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover o banco.");
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!draft.name.trim()) {
      toast.error("Informe o nome do banco.");
      return;
    }
    const normalizedDraft = normalizeBanks([draft])[0];
    if (!normalizedDraft) {
      toast.error("Informe o nome do banco.");
      return;
    }

    const next = editingId
      ? banks.map((bank) => (bank.id === editingId ? { ...normalizedDraft, id: editingId } : bank))
      : [...banks.filter((bank) => bank.id !== normalizedDraft.id), normalizedDraft];

    const filled = normalizeBanks(next);
    setSaving(true);
    try {
      const result = await onChange({ ...settings, banks: filled });
      setBanks(result?.banks ?? filled);
      cancelForm();
      toast.success(editingId ? "Banco atualizado." : "Banco salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o banco.");
    } finally {
      setSaving(false);
    }
  };

  const handleGuideUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const uploaded = await uploadGuide({ data: { fileName: file.name, base64 } });
      patchDraft({
        operationalGuideEnabled: true,
        operationalGuide: {
          storageId: uploaded.storageId,
          fileName: uploaded.fileName,
          displayName:
            draft.operationalGuide?.displayName.trim() ||
            uploaded.fileName.replace(/\.pdf$/i, ""),
        },
      });
      toast.success("PDF carregado. Salve o banco para gravar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload do PDF.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60 shadow-soft">
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="font-display text-base">Bancos</CardTitle>
            <CardDescription>
              Lista dos bancos salvos. Use &quot;Novo banco&quot; para cadastrar com formulário limpo.
            </CardDescription>
          </div>
          <Button type="button" onClick={openCreateForm} disabled={saving || formOpen}>
            <Plus className="size-4" /> Novo banco
          </Button>
        </CardHeader>
        <CardContent>
          {banks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum banco salvo ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nome do banco</th>
                    <th className="px-4 py-3 font-medium">Produto</th>
                    <th className="px-4 py-3 font-medium">Acessos</th>
                    <th className="px-4 py-3 font-medium text-right">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {banks.map((bank) => {
                    const products = productsByBankId.get(bank.id) ?? [];
                    return (
                      <tr key={bank.id} className="border-t border-border/60">
                        <td className="px-4 py-3 font-medium">{bank.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {products.length ? products.join(", ") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <AccessCheckIcon active={hasStormAccess(bank)} label="Storm" />
                            <AccessCheckIcon active={hasBankAccess(bank)} label="Banco" />
                            <AccessCheckIcon active={hasLinkAccess(bank)} label="Link" />
                            <AccessCheckIcon active={hasGuideAccess(bank)} label="Roteiro" />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDetailBank(bank)}
                          >
                            <Eye className="size-3.5" /> Detalhes
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {formOpen ? (
        <Card className="border-border/60 shadow-soft">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="font-display text-base">
                {editingId ? "Editar banco" : "Novo banco"}
              </CardTitle>
              <CardDescription>
                Campos em cards lado a lado para reduzir rolagem vertical.
              </CardDescription>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={cancelForm}>
              Cancelar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 max-w-xl">
              <Label htmlFor="bank-name">Nome do banco</Label>
              <Input
                id="bank-name"
                value={draft.name}
                onChange={(event) => patchDraft({ name: event.target.value })}
                placeholder="Ex.: V8 Digital"
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={draft.stormAccessEnabled}
                    onCheckedChange={(value) =>
                      patchDraft({ stormAccessEnabled: value === true })
                    }
                  />
                  <span>
                    <span className="font-medium">Acesso Storm</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Usuário, senha e link
                    </span>
                  </span>
                </label>
                {draft.stormAccessEnabled ? (
                  <div className="space-y-2">
                    <CredentialField
                      id="storm-user"
                      label="Usuário"
                      value={draft.stormUsername}
                      onChange={(value) => patchDraft({ stormUsername: value })}
                    />
                    <CredentialField
                      id="storm-pass"
                      label="Senha"
                      value={draft.stormPassword}
                      onChange={(value) => patchDraft({ stormPassword: value })}
                    />
                    <CredentialField
                      id="storm-link"
                      label="Link"
                      value={draft.stormLink}
                      placeholder="https://..."
                      onChange={(value) => patchDraft({ stormLink: value })}
                    />
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={draft.bankAccessEnabled}
                    onCheckedChange={(value) =>
                      patchDraft({ bankAccessEnabled: value === true })
                    }
                  />
                  <span>
                    <span className="font-medium">Acesso Banco</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Usuário, senha e link
                    </span>
                  </span>
                </label>
                {draft.bankAccessEnabled ? (
                  <div className="space-y-2">
                    <CredentialField
                      id="bank-user"
                      label="Usuário"
                      value={draft.bankUsername}
                      onChange={(value) => patchDraft({ bankUsername: value })}
                    />
                    <CredentialField
                      id="bank-pass"
                      label="Senha"
                      value={draft.bankPassword}
                      onChange={(value) => patchDraft({ bankPassword: value })}
                    />
                    <CredentialField
                      id="bank-link"
                      label="Link"
                      value={draft.bankLink}
                      placeholder="https://..."
                      onChange={(value) => patchDraft({ bankLink: value })}
                    />
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={draft.operationalGuideEnabled}
                    onCheckedChange={(value) =>
                      patchDraft({ operationalGuideEnabled: value === true })
                    }
                  />
                  <span>
                    <span className="font-medium">Roteiro Operacional</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      PDF + nome de exibição
                    </span>
                  </span>
                </label>
                {draft.operationalGuideEnabled ? (
                  <div className="space-y-2">
                    <CredentialField
                      id="guide-name"
                      label="Nome de exibição"
                      value={draft.operationalGuide?.displayName ?? ""}
                      onChange={(value) =>
                        patchDraft({
                          operationalGuide: {
                            storageId: draft.operationalGuide?.storageId ?? "",
                            fileName: draft.operationalGuide?.fileName ?? "",
                            displayName: value,
                          },
                        })
                      }
                    />
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(event) =>
                          void handleGuideUpload(event.target.files?.[0] ?? null)
                        }
                      />
                      <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                        <span>
                          <FileUp className="size-3.5" />
                          {uploading ? "Enviando…" : "Enviar PDF"}
                        </span>
                      </Button>
                    </label>
                    {draft.operationalGuide?.fileName ? (
                      <p className="text-[11px] text-muted-foreground">
                        Arquivo: {draft.operationalGuide.fileName}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void saveDraft()} disabled={saving}>
                {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Salvar banco"}
              </Button>
              <Button type="button" variant="outline" onClick={cancelForm} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={Boolean(detailBank)}
        onOpenChange={(open) => {
          if (!open) setDetailBank(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailBank?.name || "Detalhes do banco"}</DialogTitle>
            <DialogDescription>
              Informações gravadas para consulta. Use os ícones para copiar.
            </DialogDescription>
          </DialogHeader>

          {detailBank ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                <AccessCheckIcon active={hasStormAccess(detailBank)} label="Storm" />
                <AccessCheckIcon active={hasBankAccess(detailBank)} label="Banco" />
                <AccessCheckIcon active={hasLinkAccess(detailBank)} label="Link" />
                <AccessCheckIcon active={hasGuideAccess(detailBank)} label="Roteiro" />
              </div>

              {detailBank.stormAccessEnabled ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Acesso Storm</p>
                  <DetailCopyRow label="Usuário Storm" value={detailBank.stormUsername} />
                  <DetailCopyRow label="Senha Storm" value={detailBank.stormPassword} />
                  <DetailCopyRow label="Link Storm" value={detailBank.stormLink} />
                </div>
              ) : null}

              {detailBank.bankAccessEnabled ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Acesso Banco</p>
                  <DetailCopyRow label="Usuário Banco" value={detailBank.bankUsername} />
                  <DetailCopyRow label="Senha Banco" value={detailBank.bankPassword} />
                  <DetailCopyRow label="Link Banco" value={detailBank.bankLink} />
                </div>
              ) : null}

              {hasGuideAccess(detailBank) ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Roteiro Operacional</p>
                  <p className="text-sm text-muted-foreground">
                    {detailBank.operationalGuide?.displayName ||
                      detailBank.operationalGuide?.fileName}
                  </p>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a
                      href={`/api/banks/guides/${detailBank.operationalGuide!.storageId}`}
                      download={detailBank.operationalGuide?.fileName || "roteiro.pdf"}
                    >
                      <Download className="size-3.5" /> Baixar PDF
                    </a>
                  </Button>
                </div>
              ) : null}

              <div className="space-y-1">
                <p className="text-sm font-medium">Produtos vinculados</p>
                <p className="text-sm text-muted-foreground">
                  {(productsByBankId.get(detailBank.id) ?? []).join(", ") ||
                    "Nenhum produto vinculado ainda."}
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              disabled={saving || !detailBank}
              onClick={() => detailBank && void removeBank(detailBank.id)}
            >
              <Trash2 className="size-3.5" /> Excluir
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDetailBank(null)}>
                Fechar
              </Button>
              <Button
                type="button"
                onClick={() => detailBank && openEditForm(detailBank)}
                disabled={!detailBank}
              >
                Editar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
