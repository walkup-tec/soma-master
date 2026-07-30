import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, Moon, Plus, Sun, Trash2 } from "lucide-react";
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
import {
  resolveChatbotRuntimeSelection,
  type ChatbotRuntimeSelection,
} from "@/lib/config/chatbot-runtime-schedule";
import type {
  ChatbotDaySchedule,
  ChatbotRuntimeConfig,
  ChatbotTimeShift,
  SystemSettings,
  WeekdayId,
} from "@/lib/config/settings-types";
import { listStoredBotFlows, replaceStoredBotFlows } from "@/lib/bots/bot-flow.storage";
import { listBotFlowsFn } from "@/lib/bots/bots.server";
import { cn } from "@/lib/utils";

type Props = {
  settings: SystemSettings;
  onChange: (settings: SystemSettings) => void | Promise<unknown>;
};

const DEFAULT_NEW_SHIFT: ChatbotTimeShift = { start: "13:00", end: "18:00" };

function windowLabel(selection: ChatbotRuntimeSelection): string {
  switch (selection.window) {
    case "always_open":
      return "Sempre aberto";
    case "inside":
      return "Dentro do expediente";
    case "outside":
      return "Fora do expediente";
    case "day_off":
      return "Dia sem expediente";
  }
}

function BotSelect({
  id,
  label,
  hint,
  value,
  bots,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  value: string | null;
  bots: Array<{ id: string; name: string }>;
  onChange: (botId: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("space-y-2", disabled && "opacity-50")}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        disabled={disabled}
        className="flex h-10 w-full max-w-md cursor-pointer rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed"
        value={value || ""}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">Nenhum (somente humano / IA chat)</option>
        {bots.map((bot) => (
          <option key={bot.id} value={bot.id}>
            {bot.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function ChatbotRuntimeSettings({ settings, onChange }: Props) {
  const listBotFlows = useServerFn(listBotFlowsFn);
  const [runtime, setRuntime] = useState<ChatbotRuntimeConfig>(() =>
    normalizeChatbotRuntime(settings.chatbotRuntime ?? createDefaultChatbotRuntime()),
  );
  const [botsTick, setBotsTick] = useState(0);
  const bots = useMemo(() => listStoredBotFlows(), [settings.chatbotRuntime, botsTick]);
  const liveSelection = useMemo(() => resolveChatbotRuntimeSelection(runtime), [runtime]);
  const activeBotName =
    bots.find((bot) => bot.id === liveSelection.botId)?.name ||
    (liveSelection.botId ? liveSelection.botId : "Nenhum bot");

  useEffect(() => {
    setRuntime(normalizeChatbotRuntime(settings.chatbotRuntime ?? createDefaultChatbotRuntime()));
  }, [settings.chatbotRuntime]);

  useEffect(() => {
    void listBotFlows()
      .then((remote) => {
        replaceStoredBotFlows(remote);
        setBotsTick((value) => value + 1);
      })
      .catch(() => {
        /* mantém localStorage */
      });
  }, [listBotFlows]);

  const patchDay = (day: WeekdayId, patch: Partial<ChatbotDaySchedule>) => {
    setRuntime((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        [day]: { ...current.schedule[day], ...patch },
      },
    }));
  };

  const patchShift = (day: WeekdayId, index: number, patch: Partial<ChatbotTimeShift>) => {
    setRuntime((current) => {
      const daySchedule = current.schedule[day];
      const shifts = daySchedule.shifts.map((shift, i) =>
        i === index ? { ...shift, ...patch } : shift,
      );
      return {
        ...current,
        schedule: {
          ...current.schedule,
          [day]: { ...daySchedule, shifts },
        },
      };
    });
  };

  const addShift = (day: WeekdayId) => {
    setRuntime((current) => {
      const daySchedule = current.schedule[day];
      const last = daySchedule.shifts[daySchedule.shifts.length - 1];
      const nextShift: ChatbotTimeShift = last
        ? { start: last.end || DEFAULT_NEW_SHIFT.start, end: DEFAULT_NEW_SHIFT.end }
        : { ...DEFAULT_NEW_SHIFT };
      return {
        ...current,
        schedule: {
          ...current.schedule,
          [day]: {
            ...daySchedule,
            enabled: true,
            shifts: [...daySchedule.shifts, nextShift],
          },
        },
      };
    });
  };

  const removeShift = (day: WeekdayId, index: number) => {
    setRuntime((current) => {
      const daySchedule = current.schedule[day];
      if (daySchedule.shifts.length <= 1) return current;
      return {
        ...current,
        schedule: {
          ...current.schedule,
          [day]: {
            ...daySchedule,
            shifts: daySchedule.shifts.filter((_, i) => i !== index),
          },
        },
      };
    });
  };

  const save = () => {
    const next = normalizeChatbotRuntime(runtime);
    void onChange({ ...settings, chatbotRuntime: next });
    toast.success("Bots de expediente e horários salvos.");
  };

  const scheduleDisabled = runtime.alwaysOpen;

  return (
    <div className="space-y-6">
      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="font-display text-base">Bots por janela</CardTitle>
          <CardDescription>
            Defina qual fluxo atende contatos <strong>dentro</strong> e <strong>fora</strong> do
            expediente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={cn(
              "rounded-xl border px-4 py-3",
              liveSelection.inExpediente
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-amber-500/40 bg-amber-500/10",
            )}
          >
            <p className="text-sm font-medium text-foreground">
              Agora ({WEEKDAY_LABELS[liveSelection.weekday]} {liveSelection.timeLabel} Brasília):{" "}
              {windowLabel(liveSelection)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Bot ativo nesta janela:{" "}
              <span className="font-medium text-foreground">{activeBotName}</span>
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sun className="size-4 text-amber-500" />
                Bot expediente
              </p>
              <BotSelect
                id="bot-expediente"
                label="Bot no horário de expediente"
                hint="Atende contatos entrantes dentro dos dias/horários definidos abaixo."
                value={runtime.expedienteBotId}
                bots={bots}
                onChange={(expedienteBotId) =>
                  setRuntime((current) => ({ ...current, expedienteBotId }))
                }
              />
            </div>

            <div
              className={cn(
                "rounded-xl border border-border/60 bg-muted/15 p-4",
                scheduleDisabled && "opacity-60",
              )}
            >
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Moon className="size-4 text-sky-500" />
                Bot fora expediente
              </p>
              <BotSelect
                id="bot-fora-expediente"
                label="Bot fora do horário de expediente"
                hint={
                  scheduleDisabled
                    ? "Desative “Sempre aberto” para usar um bot diferente fora do expediente."
                    : "Atende contatos entrantes fora dos dias/horários de expediente."
                }
                value={runtime.foraExpedienteBotId}
                bots={bots}
                disabled={scheduleDisabled}
                onChange={(foraExpedienteBotId) =>
                  setRuntime((current) => ({ ...current, foraExpedienteBotId }))
                }
              />
            </div>
          </div>

          {bots.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Crie e salve um fluxo em <span className="font-medium text-foreground">Bots</span> para
              aparecer nas listas (o salvamento sincroniza com o servidor).
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2 text-base">
            <Clock3 className="size-4 text-primary" />
            Expediente
          </CardTitle>
          <CardDescription>
            Com <strong>Sempre aberto</strong>, só o <strong>Bot expediente</strong> atende 24h — o
            bot fora do expediente fica desativado. Por dia, adicione quantos turnos precisar (ex.:
            09:00–12:00 e 13:00–20:00).
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
                Usa apenas o Bot expediente o tempo todo, sem grade de dias/horários.
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
              Dias e turnos do expediente
            </p>
            {WEEKDAY_ORDER.map((day) => {
              const row = runtime.schedule[day];
              return (
                <div key={day} className="space-y-3 rounded-lg border border-border/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
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
                    <span className="text-xs text-muted-foreground">
                      {row.enabled
                        ? `${row.shifts.length} turno${row.shifts.length === 1 ? "" : "s"}`
                        : "Fora"}
                    </span>
                  </div>

                  {row.enabled ? (
                    <div className="space-y-2 pl-0 sm:pl-6">
                      {row.shifts.map((shift, index) => (
                        <div
                          key={`${day}-shift-${index}`}
                          className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_auto]"
                        >
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">
                              Início {row.shifts.length > 1 ? `(turno ${index + 1})` : ""}
                            </Label>
                            <Input
                              type="time"
                              value={shift.start}
                              disabled={scheduleDisabled}
                              onChange={(event) =>
                                patchShift(day, index, { start: event.target.value })
                              }
                              className="cursor-pointer"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Fim</Label>
                            <Input
                              type="time"
                              value={shift.end}
                              disabled={scheduleDisabled}
                              onChange={(event) =>
                                patchShift(day, index, { end: event.target.value })
                              }
                              className="cursor-pointer"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer shrink-0 text-muted-foreground hover:text-destructive"
                            disabled={scheduleDisabled || row.shifts.length <= 1}
                            onClick={() => removeShift(day, index)}
                            aria-label={`Remover turno ${index + 1} de ${WEEKDAY_LABELS[day]}`}
                            title={
                              row.shifts.length <= 1
                                ? "Mantenha ao menos um turno"
                                : "Remover turno"
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="cursor-pointer gap-1.5"
                        disabled={scheduleDisabled}
                        onClick={() => addShift(day)}
                      >
                        <Plus className="size-3.5" />
                        Adicionar turno
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <Button type="button" className="cursor-pointer" onClick={save}>
            Salvar bots e expediente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
