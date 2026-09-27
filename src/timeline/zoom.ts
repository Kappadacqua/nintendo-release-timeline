import { dayToDate } from "./dates";

/** Zoom levels (ITERATION-4 §6), from the most detailed. */
export type ZoomLevel = "day" | "week" | "month";

export const ZOOM_LEVELS: ZoomLevel[] = ["day", "week", "month"];

export const ZOOM: Record<ZoomLevel, { dayPx: number; label: string; largeStep: number }> = {
  // largeStep: Shift + arrow, in units of the level (a week of days, a month of weeks…).
  day: { dayPx: 32, label: "Day", largeStep: 7 },
  week: { dayPx: 8, label: "Week", largeStep: 4 },
  month: { dayPx: 2.6, label: "Month", largeStep: 3 },
};

/** The next level in `dir` (+1: zoom in, toward Day; -1: zoom out), or null at the ends. */
export function nextZoom(level: ZoomLevel, dir: 1 | -1): ZoomLevel | null {
  return ZOOM_LEVELS[ZOOM_LEVELS.indexOf(level) - dir] ?? null;
}

const MS_PER_DAY = 86_400_000;

const firstOfMonth = (y: number, m: number) => Date.UTC(y, m, 1) / MS_PER_DAY;

/** Where a glide rests at this level: the day itself, the nearest Monday, the nearest 1st. */
export function snapDay(day: number, level: ZoomLevel) {
  if (level === "day") return day;
  const date = dayToDate(day);
  if (level === "week") {
    const fromMonday = (date.getUTCDay() + 6) % 7;
    return fromMonday <= 3 ? day - fromMonday : day + 7 - fromMonday;
  }
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const start = firstOfMonth(y, m);
  const next = firstOfMonth(y, m + 1);
  return day - start <= next - day ? start : next;
}

/** `units` days, weeks or months after `day` (a month step lands on the 1st). */
export function addUnits(day: number, units: number, level: ZoomLevel) {
  if (level === "day") return day + units;
  if (level === "week") return day + units * 7;
  const date = dayToDate(day);
  return firstOfMonth(date.getUTCFullYear(), date.getUTCMonth() + units);
}

/** ISO 8601 week number. */
export function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Thursday of this week decides the year.
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / MS_PER_DAY - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}
