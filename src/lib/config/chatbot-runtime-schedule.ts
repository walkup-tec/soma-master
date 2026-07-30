import { WEEKDAY_ORDER } from "@/lib/config/settings-defaults";
import type {
  ChatbotRuntimeConfig,
  ChatbotTimeShift,
  WeekdayId,
} from "@/lib/config/settings-types";
import { getBrasiliaParts } from "@/lib/bots/bot-expediente";

const BRASILIA_TZ = "America/Sao_Paulo";

/** Segunda=0 … Domingo=6 no Intl (weekday short em en-GB). */
const WEEKDAY_FROM_EN: Record<string, WeekdayId> = {
  mon: "mon",
  tue: "tue",
  wed: "wed",
  thu: "thu",
  fri: "fri",
  sat: "sat",
  sun: "sun",
};

export type ChatbotRuntimeWindow =
  | "always_open"
  | "inside"
  | "outside"
  | "day_off";

export type ChatbotRuntimeSelection = {
  inExpediente: boolean;
  window: ChatbotRuntimeWindow;
  botId: string | null;
  weekday: WeekdayId;
  timeLabel: string;
};

export function timeHmToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

/** Inclusivo nos extremos (09:00–12:00 inclui 09:00 e 12:00). Suporta turno que cruza meia-noite. */
export function isMinutesInShift(minutes: number, shift: ChatbotTimeShift): boolean {
  const start = timeHmToMinutes(shift.start);
  const end = timeHmToMinutes(shift.end);
  if (start == null || end == null) return false;
  if (start === end) return minutes === start;
  if (start < end) return minutes >= start && minutes <= end;
  // Ex.: 22:00–06:00
  return minutes >= start || minutes <= end;
}

export function getBrasiliaWeekdayId(now = new Date()): WeekdayId {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: BRASILIA_TZ,
    weekday: "short",
  });
  const raw = fmt.format(now).toLowerCase().replace(".", "").slice(0, 3);
  return WEEKDAY_FROM_EN[raw] ?? WEEKDAY_ORDER[0];
}

export function isWithinChatbotExpediente(
  runtime: ChatbotRuntimeConfig,
  now = new Date(),
): boolean {
  if (runtime.alwaysOpen) return true;
  const weekday = getBrasiliaWeekdayId(now);
  const day = runtime.schedule[weekday];
  if (!day?.enabled) return false;
  const { hour, minute } = getBrasiliaParts(now);
  const minutes = hour * 60 + minute;
  const shifts = day.shifts?.length ? day.shifts : [];
  return shifts.some((shift) => isMinutesInShift(minutes, shift));
}

export function resolveChatbotRuntimeSelection(
  runtime: ChatbotRuntimeConfig,
  now = new Date(),
): ChatbotRuntimeSelection {
  const weekday = getBrasiliaWeekdayId(now);
  const { hour, minute } = getBrasiliaParts(now);
  const timeLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  if (runtime.alwaysOpen) {
    return {
      inExpediente: true,
      window: "always_open",
      botId: runtime.expedienteBotId,
      weekday,
      timeLabel,
    };
  }

  const day = runtime.schedule[weekday];
  if (!day?.enabled) {
    return {
      inExpediente: false,
      window: "day_off",
      botId: runtime.foraExpedienteBotId,
      weekday,
      timeLabel,
    };
  }

  const minutes = hour * 60 + minute;
  const inside = (day.shifts ?? []).some((shift) => isMinutesInShift(minutes, shift));
  if (inside) {
    return {
      inExpediente: true,
      window: "inside",
      botId: runtime.expedienteBotId,
      weekday,
      timeLabel,
    };
  }

  return {
    inExpediente: false,
    window: "outside",
    botId: runtime.foraExpedienteBotId,
    weekday,
    timeLabel,
  };
}
