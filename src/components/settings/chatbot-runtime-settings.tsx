import { useEffect, useMemo, useState } from "react";
import { Clock3, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  createDefaultChatbotRuntime,
  normalizeChatbotRuntime,
} from "@/lib/config/settings-defaults";
import type { ChatbotRuntimeConfig, SystemSettings, WeekdayId } from "@/lib/config/settings-types";
import { listStoredBotFlows } from "@/lib/bots/bot-flow.storage";
import { cn } from "@/lib/utils";

type Props = {
  settings: SystemSettings;
  onChange: (settings: SystemSettings) => void | Promise<unknown>;
};

export function ChatbotRuntimeSettings({ settings, onChange }: Props) {
  const [runtime, setRuntime] = useState<ChatbotRuntimeConfig>(() =>
    normalizeChatbotRuntime(settings.chatbotRuntime ?? createDefaultChatbotRuntime()),
  );
  const bots = useMemo(() => listStoredBotFlows(), [settings.chatbotRuntime]);

  useEffect(() => {
    setRuntime(normalizeChatbotRuntime(settings.chatbotRuntime ?? createDefaultChatbotRuntime()));
  }, [settings.chatbotRuntime]);

  const patchDay = (day: WeekdayId, patch: Partial<ChatbotRuntimeConfig["schedule"][WeekdayId]>) => {
    setRuntime((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        [day]: { ...current.schedule[day], ...patch },
      },
    }));
  };

  const save = () => {
    const next = normalizeChatbotRuntime(runtime);
    if (!next.activeBotId) {
      toast.message("Selecione um bot ativo ou deixe vazio para nenhum atendimento automático.");
    }
    void onChange({ ...settings, chatbotRuntime: next });
    toast.success("Bot ativo e expediente salvos.");
  };

  const scheduleDisabled = runtime.alwaysOpen;

  return (
    <div className="space-y-6">
      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2 text-base">
            <Power className="size-4 text-primary" />
            Bot ativo
          </CardTitle>
          <CardDescription>
            Quando um lead entrar em contato no WhatsApp, o atendimento automático usa este fluxo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="active-bot">Bot que atende novos contatos</Label>
            <select
              id="active-bot"
              className="flex h-10 w-full max-w-md cursor-pointer rounded-md border border-input bg-background px-3 text-sm"
              value={runtime.activeBotId || ""}
              onChange={(event) =>
                setRuntime((current) => ({
                  ...current,
                  activeBotId: event.target.value || null,
                }))
              }
            >
              <option value="">Nenhum (somente humano / IA chat)</option>
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}
                </option>
              ))}
            </select>
            {bots.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Crie um fluxo em <span className="font-medium text-foreground">Bots</span> para
                aparecer aqui.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2 text-base">
            <Clock3 className="size-4 text-primary" />
            Expediente
          </CardTitle>
          <CardDescription>
            Defina quando o bot responde. Com <strong>Sempre aberto</strong>, dias e horários ficam
            desabilitados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div
            className={cn(
              "flex items-start justify-between gap-4 rounded-xl border px-4 py-3",
              runtime.alwaysOpen
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-border/60 bg-muted/20",
            )}
          >
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Sempre aberto</p>
              <p className="text-xs text-muted-foreground">
                O bot fica disponível 24h, todos os dias — ideal para captura contínua de leads.
              </p>
            </div>
            <Switch
              checked={runtime.alwaysOpen}
              onCheckedChange={(checked) =>
                setRuntime((current) => ({ ...current, alwaysOpen: checked === true }))
              }
              aria-label="Sempre aberto"
            />
          </div>

          <div
            className={cn(
              "space-y-3 transition-opacity",
              scheduleDisabled && "pointer-events-none opacity-45",
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dias e horários
            </p>
            {WEEKDAY_ORDER.map((day) => {
              const row = runtime.schedule[day];
              return (
                <div
                  key={day}
                  className="grid grid-cols-1 items-center gap-3 rounded-lg border border-border/50 p-3 sm:grid-cols-[7rem_auto_1fr_1fr]"
                >
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-primary"
                      checked={row.enabled}
                      disabled={scheduleDisabled}
                      onChange={(event) => patchDay(day, { enabled: event.target.checked })}
                    />
                    {WEEKDAY_LABELS[day]}
                  </label>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {row.enabled ? "Aberto" : "Fechado"}
                  </span>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Início</Label>
                    <Input
                      type="time"
                      value={row.start}
                      disabled={scheduleDisabled || !row.enabled}
                      onChange={(event) => patchDay(day, { start: event.target.value })}
                      className="cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Fim</Label>
                    <Input
                      type="time"
                      value={row.end}
                      disabled={scheduleDisabled || !row.enabled}
                      onChange={(event) => patchDay(day, { end: event.target.value })}
                      className="cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Button type="button" className="cursor-pointer" onClick={save}>
            Salvar bot ativo e expediente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
