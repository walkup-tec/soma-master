import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/clients/status-badge";
import {
  createEmptyAttendanceStatus,
  normalizeAutoReturnDays,
} from "@/lib/config/settings-defaults";
import { DEFAULT_STATUS_COLOR, normalizeStatusColor } from "@/lib/config/status-colors";
import type { AttendanceStatusConfig, SystemSettings } from "@/lib/config/settings-types";

type Props = {
  settings: SystemSettings;
  onChange: (settings: SystemSettings) => void;
};

export function AttendanceStatusesSettings({ settings, onChange }: Props) {
  const [statuses, setStatuses] = useState<AttendanceStatusConfig[]>(
    settings.attendanceStatuses ?? [],
  );

  useEffect(() => {
    setStatuses(settings.attendanceStatuses ?? []);
  }, [settings.attendanceStatuses]);

  const updateStatus = (id: string, patch: Partial<AttendanceStatusConfig>) => {
    setStatuses((prev) =>
      prev.map((status) => (status.id === id ? { ...status, ...patch } : status)),
    );
  };

  const addStatus = () => {
    setStatuses((prev) => [...prev, createEmptyAttendanceStatus()]);
  };

  const removeStatus = (id: string) => {
    setStatuses((prev) => prev.filter((status) => status.id !== id));
  };

  const saveStatuses = () => {
    const filled = statuses
      .filter((status) => status.label.trim())
      .map((status) => ({
        ...status,
        label: status.label.trim(),
        color: normalizeStatusColor(status.color, DEFAULT_STATUS_COLOR),
        autoReturnDays: normalizeAutoReturnDays(status.autoReturnDays),
      }));
    if (filled.length === 0) {
      toast.error("Informe ao menos um status com nome preenchido.");
      return;
    }
    void onChange({ ...settings, attendanceStatuses: filled });
    toast.success("Status de atendimento salvos.");
  };

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader>
        <CardTitle className="font-display text-base">Status de atendimento</CardTitle>
        <CardDescription>
          Defina os status, cores e o retorno automático na Agenda ao atribuir o status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Em Retorno Automático, informe quantos dias até o próximo contato (0 ou vazio =
          desligado). Ao atribuir o status, a Agenda do usuário recebe a data automaticamente.
        </div>

        <div className="space-y-3">
          {statuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum status cadastrado. Clique em &quot;Adicionar status&quot;.
            </p>
          ) : (
            statuses.map((status, index) => (
              <div
                key={status.id}
                className="flex flex-col gap-3 rounded-lg border border-border/50 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-start"
              >
                <div className="w-full max-w-[13.5rem] space-y-2 sm:w-[13.5rem]">
                  <Label htmlFor={`status-${status.id}`} className="flex flex-col gap-0.5">
                    <span>Status {index + 1}</span>
                    <span className="truncate text-[11px] font-normal text-muted-foreground">
                      ID: {status.id}
                    </span>
                  </Label>
                  <Input
                    id={`status-${status.id}`}
                    value={status.label}
                    onChange={(event) => updateStatus(status.id, { label: event.target.value })}
                    placeholder="Nome do status"
                  />
                </div>

                <input
                  id={`status-color-${status.id}`}
                  type="color"
                  value={normalizeStatusColor(status.color)}
                  onChange={(event) => updateStatus(status.id, { color: event.target.value })}
                  className="mb-0.5 h-9 w-9 shrink-0 cursor-pointer appearance-none border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-0"
                  aria-label={`Cor do status ${status.label || index + 1}`}
                  title="Cor do status"
                />

                <div className="w-full max-w-[11rem] space-y-2 sm:w-[11rem]">
                  <Label htmlFor={`status-auto-return-${status.id}`}>Retorno Automático</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`status-auto-return-${status.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={90}
                      step={1}
                      placeholder="0"
                      value={status.autoReturnDays ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (raw === "") {
                          updateStatus(status.id, { autoReturnDays: null });
                          return;
                        }
                        updateStatus(status.id, {
                          autoReturnDays: normalizeAutoReturnDays(raw),
                        });
                      }}
                      className="w-20"
                    />
                    <span className="shrink-0 text-sm text-muted-foreground">dias</span>
                  </div>
                </div>

                <div className="flex w-full items-center justify-start gap-2 sm:mb-0.5 sm:w-auto">
                  <StatusBadge
                    label={status.label.trim() || "Prévia"}
                    color={status.color}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => removeStatus(status.id)}
                    aria-label="Remover status"
                    disabled={statuses.length <= 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={addStatus}>
            <Plus className="size-4" /> Adicionar status
          </Button>
          <Button type="button" onClick={saveStatuses}>
            Salvar status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
