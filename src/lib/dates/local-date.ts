const TIME_ZONE = "America/Sao_Paulo";

export function localDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

export function localTomorrowString(): string {
  return addLocalDays(1);
}

/** Soma dias civis à data local (America/Sao_Paulo), retorna YYYY-MM-DD. */
export function addLocalDays(days: number, from = new Date()): string {
  const base = localDateString(from);
  const [year, month, day] = base.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day!));
  utc.setUTCDate(utc.getUTCDate() + days);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatLocalDateLabel(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year!, month! - 1, day);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Presets do filtro "Data do Registro" — relativos ao dia atual (fuso SP). */
export type RegistrationDatePreset =
  | "all"
  | "today"
  | "yesterday"
  | "week"
  | "15"
  | "30"
  | "custom";

export function resolveRegistrationDateRange(
  preset: Exclude<RegistrationDatePreset, "all" | "custom">,
  now = new Date(),
): { from: string; to: string } {
  const today = localDateString(now);
  if (preset === "today") {
    return { from: today, to: today };
  }
  if (preset === "yesterday") {
    const yesterday = addLocalDays(-1, now);
    return { from: yesterday, to: yesterday };
  }
  if (preset === "week") {
    // Últimos 7 dias incluindo hoje
    return { from: addLocalDays(-6, now), to: today };
  }
  if (preset === "15") {
    return { from: addLocalDays(-14, now), to: today };
  }
  return { from: addLocalDays(-29, now), to: today };
}

/** Presets do Remarketing — data de contato relativa ao dia atual (fuso SP). */
export type RemarketingDatePreset = "today" | "week" | "next15" | "next30";

/**
 * Janelas inclusive relativas ao dia da aplicação do filtro (fuso SP):
 * - hoje: dia único
 * - semana / próximos 15 / 30: amanhã … hoje+7 / +15 / +30 (não incluem hoje)
 */
export function resolveRemarketingDateRange(
  preset: RemarketingDatePreset,
  now = new Date(),
): { from: string; to: string } {
  const today = localDateString(now);
  if (preset === "today") return { from: today, to: today };
  const tomorrow = addLocalDays(1, now);
  if (preset === "week") {
    return { from: tomorrow, to: addLocalDays(7, now) };
  }
  if (preset === "next15") {
    return { from: tomorrow, to: addLocalDays(15, now) };
  }
  return { from: tomorrow, to: addLocalDays(30, now) };
}

/** Soma dias a uma data YYYY-MM-DD (calendário civil SP). */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day!));
  utc.setUTCDate(utc.getUTCDate() + days);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Segunda-feira da semana (ISO) que contém a data YYYY-MM-DD. */
export function startOfWeekMondayFromIso(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day!));
  const weekday = utc.getUTCDay(); // 0 = domingo
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDaysToIsoDate(isoDate, offset);
}

/** Segunda-feira da semana (ISO) que contém `now` no fuso SP. */
export function startOfLocalWeekMonday(now = new Date()): string {
  return startOfWeekMondayFromIso(localDateString(now));
}

export function endOfWeekSundayFromIso(isoDate: string): string {
  return addDaysToIsoDate(startOfWeekMondayFromIso(isoDate), 6);
}

export function endOfLocalWeekSunday(now = new Date()): string {
  return endOfWeekSundayFromIso(localDateString(now));
}

/** Cabeçalhos Seg–Dom (pt-BR) para grade semanal/mensal. */
export const LOCAL_WEEKDAY_HEADERS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

export function localMonthBounds(now = new Date()): { from: string; to: string } {
  const today = localDateString(now);
  const [year, month] = today.split("-").map(Number);
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

/** Lista YYYY-MM-DD de `from` até `to` (inclusive). */
export function eachLocalDateInclusive(from: string, to: string): string[] {
  if (from > to) return [];
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDaysToIsoDate(cursor, 1);
  }
  return dates;
}

export function formatLocalDayColumnLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year!, month! - 1, day);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

/** Rótulo curto para colunas da semana no Kanban (ex.: Seg 14). */
export function formatLocalWeekdayColumnLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year!, month! - 1, day);
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    weekday: "short",
  })
    .format(date)
    .replace(".", "")
    .replace(/^\w/, (char) => char.toUpperCase());
  const dayNum = String(day).padStart(2, "0");
  return `${weekday} ${dayNum}`;
}

/** Converte ISO createdAt para YYYY-MM-DD no fuso SP. */
export function createdAtToLocalDate(isoCreatedAt: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(
      new Date(isoCreatedAt),
    );
  } catch {
    return null;
  }
}
