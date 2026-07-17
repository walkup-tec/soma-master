import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, FileUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadBankOperationalGuideFn } from "@/lib/config/settings.server";
import { createEmptyBank, normalizeBanks } from "@/lib/config/settings-defaults";
import type { BankConfig, SystemSettings } from "@/lib/config/settings-types";

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

export function BanksSettings({ settings, onChange }: Props) {
  const uploadGuide = useServerFn(uploadBankOperationalGuideFn);
  const [banks, setBanks] = useState<BankConfig[]>(settings.banks ?? []);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    setBanks(settings.banks ?? []);
  }, [settings.banks]);

  const patchBank = (id: string, patch: Partial<BankConfig>) => {
    setBanks((prev) => prev.map((bank) => (bank.id === id ? { ...bank, ...patch } : bank)));
  };

  const addBank = () => {
    setBanks((prev) => [...prev, createEmptyBank()]);
  };

  const removeBank = (id: string) => {
    setBanks((prev) => prev.filter((bank) => bank.id !== id));
  };

  const saveBanks = async () => {
    const filled = normalizeBanks(banks);
    if (filled.length === 0) {
      toast.error("Informe ao menos um banco com nome preenchido.");
      return;
    }
    setSaving(true);
    try {
      const result = await onChange({ ...settings, banks: filled });
      if (result?.banks) setBanks(result.banks);
      else setBanks(filled);
      toast.success("Bancos salvos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar os bancos.");
    } finally {
      setSaving(false);
    }
  };

  const handleGuideUpload = async (bankId: string, file: File | null, displayName: string) => {
    if (!file) return;
    setUploadingId(bankId);
    try {
      const base64 = await fileToBase64(file);
      const uploaded = await uploadGuide({ data: { fileName: file.name, base64 } });
      patchBank(bankId, {
        operationalGuideEnabled: true,
        operationalGuide: {
          storageId: uploaded.storageId,
          fileName: uploaded.fileName,
          displayName: displayName.trim() || uploaded.fileName.replace(/\.pdf$/i, ""),
        },
      });
      toast.success("PDF do roteiro carregado. Salve os bancos para gravar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload do PDF.");
    } finally {
      setUploadingId(null);
    }
  };

  const savedById = new Map((settings.banks ?? []).map((bank) => [bank.id, bank]));

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader>
        <CardTitle className="font-display text-base">Bancos</CardTitle>
        <CardDescription>
          Cadastre bancos, acessos para consulta e roteiros operacionais em PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          {banks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum banco cadastrado. Clique em &quot;Adicionar banco&quot;.
            </p>
          ) : (
            banks.map((bank, index) => {
              const saved = savedById.get(bank.id);
              return (
                <div
                  key={bank.id}
                  className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`bank-name-${bank.id}`}>Banco {index + 1}</Label>
                      <Input
                        id={`bank-name-${bank.id}`}
                        value={bank.name}
                        onChange={(event) => patchBank(bank.id, { name: event.target.value })}
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

                  <div className="space-y-3">
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={bank.stormAccessEnabled}
                        onCheckedChange={(value) =>
                          patchBank(bank.id, { stormAccessEnabled: value === true })
                        }
                      />
                      <span>
                        <span className="font-medium">Acesso Storm</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Usuário e senha apenas para consulta futura.
                        </span>
                      </span>
                    </label>
                    {bank.stormAccessEnabled ? (
                      <div className="ml-7 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`storm-user-${bank.id}`}>Usuário Storm</Label>
                          <Input
                            id={`storm-user-${bank.id}`}
                            value={bank.stormUsername}
                            onChange={(event) =>
                              patchBank(bank.id, { stormUsername: event.target.value })
                            }
                            autoComplete="off"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`storm-pass-${bank.id}`}>Senha Storm</Label>
                          <Input
                            id={`storm-pass-${bank.id}`}
                            type="password"
                            value={bank.stormPassword}
                            onChange={(event) =>
                              patchBank(bank.id, { stormPassword: event.target.value })
                            }
                            autoComplete="new-password"
                          />
                        </div>
                        {saved?.stormAccessEnabled &&
                        (saved.stormUsername || saved.stormPassword) ? (
                          <div className="flex flex-wrap gap-2 sm:col-span-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void copyText("Usuário Storm", saved.stormUsername)}
                            >
                              <Copy className="size-3.5" /> Copiar usuário
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void copyText("Senha Storm", saved.stormPassword)}
                            >
                              <Copy className="size-3.5" /> Copiar senha
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={bank.bankAccessEnabled}
                        onCheckedChange={(value) =>
                          patchBank(bank.id, { bankAccessEnabled: value === true })
                        }
                      />
                      <span>
                        <span className="font-medium">Acesso Banco</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Usuário e senha apenas para consulta futura.
                        </span>
                      </span>
                    </label>
                    {bank.bankAccessEnabled ? (
                      <div className="ml-7 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`bank-user-${bank.id}`}>Usuário Banco</Label>
                          <Input
                            id={`bank-user-${bank.id}`}
                            value={bank.bankUsername}
                            onChange={(event) =>
                              patchBank(bank.id, { bankUsername: event.target.value })
                            }
                            autoComplete="off"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`bank-pass-${bank.id}`}>Senha Banco</Label>
                          <Input
                            id={`bank-pass-${bank.id}`}
                            type="password"
                            value={bank.bankPassword}
                            onChange={(event) =>
                              patchBank(bank.id, { bankPassword: event.target.value })
                            }
                            autoComplete="new-password"
                          />
                        </div>
                        {saved?.bankAccessEnabled &&
                        (saved.bankUsername || saved.bankPassword) ? (
                          <div className="flex flex-wrap gap-2 sm:col-span-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void copyText("Usuário Banco", saved.bankUsername)}
                            >
                              <Copy className="size-3.5" /> Copiar usuário
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void copyText("Senha Banco", saved.bankPassword)}
                            >
                              <Copy className="size-3.5" /> Copiar senha
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={bank.operationalGuideEnabled}
                        onCheckedChange={(value) =>
                          patchBank(bank.id, { operationalGuideEnabled: value === true })
                        }
                      />
                      <span>
                        <span className="font-medium">Informa o Roteiro Operacional</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          PDF com nome de exibição no sistema.
                        </span>
                      </span>
                    </label>
                    {bank.operationalGuideEnabled ? (
                      <div className="ml-7 space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor={`guide-name-${bank.id}`}>Nome de exibição</Label>
                          <Input
                            id={`guide-name-${bank.id}`}
                            value={bank.operationalGuide?.displayName ?? ""}
                            onChange={(event) =>
                              patchBank(bank.id, {
                                operationalGuide: {
                                  storageId: bank.operationalGuide?.storageId ?? "",
                                  fileName: bank.operationalGuide?.fileName ?? "",
                                  displayName: event.target.value,
                                },
                              })
                            }
                            placeholder="Ex.: Roteiro consignado V8"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex">
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              className="hidden"
                              onChange={(event) =>
                                void handleGuideUpload(
                                  bank.id,
                                  event.target.files?.[0] ?? null,
                                  bank.operationalGuide?.displayName ?? "",
                                )
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              asChild
                              disabled={uploadingId === bank.id}
                            >
                              <span>
                                <FileUp className="size-3.5" />
                                {uploadingId === bank.id ? "Enviando…" : "Enviar PDF"}
                              </span>
                            </Button>
                          </label>
                          {bank.operationalGuide?.fileName ? (
                            <span className="text-xs text-muted-foreground">
                              Arquivo: {bank.operationalGuide.fileName}
                              {bank.operationalGuide.displayName
                                ? ` · Exibição: ${bank.operationalGuide.displayName}`
                                : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Nenhum PDF ainda.</span>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={addBank} disabled={saving}>
            <Plus className="size-4" /> Adicionar banco
          </Button>
          <Button type="button" onClick={() => void saveBanks()} disabled={saving}>
            {saving ? "Salvando…" : "Salvar bancos"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
