import type { AttendanceStatusConfig } from "@/lib/config/settings-types";
import type { KanbanListItem, KanbanViewMode } from "@/lib/clients/client.types";
import {
  addLocalDays,
  createdAtToLocalDate,
  eachLocalDateInclusive,
  endOfLocalWeekSunday,
  endOfWeekSundayFromIso,
  formatLocalWeekdayColumnLabel,
  localDateString,
  localMonthBounds,
  startOfLocalWeekMonday,
  startOfWeekMondayFromIso,
} from "@/lib/dates/local-date";

/** Filtro de período no Kanban por Status (data do board = contato ou cadastro). */
export type KanbanPeriodPreset = "all" | "day" | "week" | "15" | "30";

export function resolveKanbanPeriodRange(
  preset: Exclude<KanbanPeriodPreset, "all">,
  now = new Date(),
): { from: string; to: string } {
  const today = localDateString(now);
  if (preset === "day") return { from: today, to: today };
  if (preset === "week") {
    return { from: startOfLocalWeekMonday(now), to: endOfLocalWeekSunday(now) };
  }
  if (preset === "15") return { from: addLocalDays(-14, now), to: today };
  return { from: addLocalDays(-29, now), to: today };
}

export function filterKanbanItemsByPeriod(
  items: KanbanListItem[],
  preset: KanbanPeriodPreset,
  now = new Date(),
): KanbanListItem[] {
  if (preset === "all") return items;
  const { from, to } = resolveKanbanPeriodRange(preset, now);
  return items.filter((item) => {
    const boardDate = resolveKanbanBoardDate(item);
    return Boolean(boardDate && boardDate >= from && boardDate <= to);
  });
}

/** `statusIds` vazio = todos os status. */
export function filterKanbanItemsByStatuses(
  items: KanbanListItem[],
  statusIds: string[],
): KanbanListItem[] {
  if (statusIds.length === 0) return items;
  const allowed = new Set(statusIds);
  return items.filter((item) => allowed.has(item.status));
}

/**
 * Grade do Kanban Status: quantas colunas por linha / linhas na tela
 * para caber todos os status visíveis sem scroll horizontal.
 */
export function layoutKanbanStatusGrid(columnCount: number): { cols: number; rows: number } {
  if (columnCount <= 0) return { cols: 1, rows: 1 };
  if (columnCount <= 4) return { cols: columnCount, rows: 1 };
  if (columnCount <= 6) return { cols: 3, rows: 2 };
  if (columnCount <= 8) return { cols: 4, rows: 2 };
  const cols = 4;
  return { cols, rows: Math.ceil(columnCount / cols) };
}

export type KanbanColumn = {
  id: string;
  title: string;
  accentColor?: string;
  items: KanbanListItem[];
};

export type KanbanDayCell = {
  id: string;
  dayLabel: string;
  inMonth: boolean;
  items: KanbanListItem[];
};

export type KanbanWeekRow = {
  id: string;
  days: KanbanDayCell[];
};

export function resolveKanbanBoardDate(item: KanbanListItem): string | null {
  if (item.contactDate) return item.contactDate.slice(0, 10);
  return createdAtToLocalDate(item.createdAt);
}

function sortItems(items: KanbanListItem[]): KanbanListItem[] {
  return [...items].sort((left, right) => {
    const leftName = (left.nome ?? left.cpf ?? "").toLocaleLowerCase("pt-BR");
    const rightName = (right.nome ?? right.cpf ?? "").toLocaleLowerCase("pt-BR");
    return leftName.localeCompare(rightName, "pt-BR");
  });
}

function bucketItemsByDate(
  items: KanbanListItem[],
  from: string,
  to: string,
): Map<string, KanbanListItem[]> {
  const buckets = new Map<string, KanbanListItem[]>();
  for (const date of eachLocalDateInclusive(from, to)) {
    buckets.set(date, []);
  }
  for (const item of items) {
    const boardDate = resolveKanbanBoardDate(item);
    if (!boardDate || boardDate < from || boardDate > to) continue;
    buckets.get(boardDate)?.push(item);
  }
  return buckets;
}

export function buildKanbanColumns(
  view: Exclude<KanbanViewMode, "monthly">,
  items: KanbanListItem[],
  statuses: AttendanceStatusConfig[],
): KanbanColumn[] {
  if (view === "status") {
    const known = new Set(statuses.map((status) => status.id));
    const columns: KanbanColumn[] = statuses.map((status) => ({
      id: status.id,
      title: status.label,
      accentColor: status.color,
      items: sortItems(items.filter((item) => item.status === status.id)),
    }));
    const orphan = items.filter((item) => !known.has(item.status));
    if (orphan.length > 0) {
      columns.push({
        id: "__other__",
        title: "Outros",
        items: sortItems(orphan),
      });
    }
    // Só colunas com cards — o layout calcula linhas/colunas na tela.
    return columns.filter((column) => column.items.length > 0);
  }

  const range = { from: startOfLocalWeekMonday(), to: endOfLocalWeekSunday() };
  const buckets = bucketItemsByDate(items, range.from, range.to);
  const dates = eachLocalDateInclusive(range.from, range.to);

  return dates.map((date) => ({
    id: date,
    title: formatLocalWeekdayColumnLabel(date),
    items: sortItems(buckets.get(date) ?? []),
  }));
}

/**
 * Calendário do mês: cada linha = 1 semana (Seg–Dom), preenchendo a grade
 * até cobrir o mês inteiro em tela.
 */
export function buildKanbanMonthWeeks(items: KanbanListItem[]): KanbanWeekRow[] {
  const { from, to } = localMonthBounds();
  const gridStart = startOfWeekMondayFromIso(from);
  const gridEnd = endOfWeekSundayFromIso(to);
  const dates = eachLocalDateInclusive(gridStart, gridEnd);
  const buckets = bucketItemsByDate(items, from, to);

  const weeks: KanbanWeekRow[] = [];
  for (let index = 0; index < dates.length; index += 7) {
    const weekDates = dates.slice(index, index + 7);
    weeks.push({
      id: weekDates[0] ?? `week-${weeks.length}`,
      days: weekDates.map((date) => {
        const dayNum = date.slice(8, 10);
        const inMonth = date >= from && date <= to;
        return {
          id: date,
          dayLabel: dayNum.replace(/^0/, "") || dayNum,
          inMonth,
          items: inMonth ? sortItems(buckets.get(date) ?? []) : [],
        };
      }),
    });
  }
  return weeks;
}

export function countKanbanMonthCards(weeks: KanbanWeekRow[]): number {
  return weeks.reduce(
    (sum, week) => sum + week.days.reduce((daySum, day) => daySum + day.items.length, 0),
    0,
  );
}
