import { TIMELINE } from "./config";
import { dayToDate, MONTHS } from "./dates";
import { isoWeek, type ZoomLevel } from "./zoom";

export interface TickPalette {
  tick: string;
  label: string;
  accent: string;
  /** The pill under the playhead: a fill with text on it. */
  accentFill: string;
  onAccent: string;
  font: string;
}

export interface TickView {
  ctx: CanvasRenderingContext2D;
  /** World x of the canvas' left edge, and its width. */
  left: number;
  width: number;
  /** Line y on the canvas. */
  y: number;
  dayPx: number;
  startDay: number;
  endDay: number;
  todayDay: number;
  /** Day under the playhead, or null in the TBA zone. */
  centerDay: number | null;
  zoom: ZoomLevel;
  palette: TickPalette;
  /**
   * Vertical timeline (SPEC "Mobile"): the context is transposed (world x runs down the
   * screen, `y` is the line's x), so ticks draw as they are; labels are written upright in the
   * gutter left of the line, with the canvas' own pixel ratio.
   */
  vertical?: { dpr: number };
}

/** The playhead pill, in px below the line: its top edge and height (also used to break the playhead line). */
export const PILL = { top: 22, height: 22 };
/** Vertical timeline: the pill's right edge, and the day numbers' right edge, in px left of the line. */
export const PILL_V = { gap: 6, labelGap: 20 };

const monthShort = (date: Date) => MONTHS[date.getUTCMonth()].slice(0, 3).toUpperCase();

/**
 * Ticks and labels for the visible part of the dated line, adapted to the zoom level
 * (ITERATION-4 §6): Day — every day, numbers on 1, 5, 10…; Week — Mondays numbered
 * "W23"; Month — month starts only. The unit under the playhead gets an accent pill.
 */
export function drawTicks(v: TickView) {
  const { ctx, left, width, y, dayPx, startDay, palette } = v;
  const first = Math.max(0, Math.floor(left / dayPx) - 1);
  const last = Math.min(v.endDay - startDay, Math.ceil((left + width) / dayPx) + 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // The playhead pill, drawn last: month labels right under it are skipped, and so is a
  // label that would run into the previous one (e.g. "JUN 5, 2025" and "JUL" zoomed out).
  const pill = pillOf(v);
  let labelEnd = -Infinity;
  const vert = v.vertical;
  /** Writes upright text: under the line (horizontal) or in the gutter left of it (vertical). */
  const write = (label: string, at: number, below: number, kind: "small" | "month") => {
    if (!vert) return ctx.fillText(label, at, y + below);
    ctx.save();
    ctx.setTransform(vert.dpr, 0, 0, vert.dpr, 0, 0);
    ctx.textBaseline = "middle";
    if (kind === "small") {
      ctx.textAlign = "right";
      ctx.fillText(label, y - PILL_V.labelGap, at);
    } else {
      // "JAN 2026", "JUN 5, 2025": the month on one line, the rest under it.
      const [first, ...rest] = label.split(" ");
      ctx.textAlign = "left";
      ctx.fillText(first, 4, at);
      if (rest.length) {
        ctx.font = `700 10px ${palette.font}`;
        ctx.fillText(rest.join(" ").replace(",", ""), 4, at + 13);
      }
    }
    ctx.restore();
  };

  for (let i = first; i <= last; i++) {
    const day = startDay + i;
    const date = dayToDate(day);
    const x = Math.round(i * dayPx - left);
    const monthStart = date.getUTCDate() === 1;
    const monday = date.getUTCDay() === 1;
    ctx.globalAlpha = day > v.todayDay ? 0.55 : 1;

    // Tick size: month start, then Monday, then plain day (hidden when days are too close).
    let half = 0;
    let w = 1;
    if (monthStart) [half, w] = [22, 2];
    else if (monday && v.zoom !== "month") [half, w] = [11, 1.5];
    else if (v.zoom === "day") [half, w] = [5, 1];
    // Vertical: shorter ticks, so the day numbers beside the line stay clear of them.
    if (vert) half = Math.round(half * 0.62);
    if (half) {
      ctx.fillStyle = palette.tick;
      ctx.fillRect(x - w / 2, y - half, w, half * 2);
    }

    // Small labels under the line: day numbers, or week numbers.
    const isCenter = day === v.centerDay;
    ctx.fillStyle = palette.label;
    ctx.font = `700 11px ${palette.font}`;
    // Vertical: the month label takes the 1st's place in the gutter.
    if (v.zoom === "day" && !isCenter && TIMELINE.labeledDays.includes(date.getUTCDate()) && !(vert && monthStart)) {
      write(String(date.getUTCDate()), x, 27, "small");
    } else if (v.zoom === "week" && monday && !isCenter && !(vert && nearMonthStart(date))) {
      write(`W${isoWeek(date)}`, x, 27, "small");
    }

    // Month labels (with the year in January, and the full date at the very start).
    if (monthStart || i === 0) {
      const month = monthShort(date);
      const label =
        i === 0 ? `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}` : date.getUTCMonth() === 0 ? `${month} ${date.getUTCFullYear()}` : month;
      ctx.font = `800 13px ${palette.font}`;
      // Along the line a label takes its width (horizontal) or one / two lines (vertical, centred on its day).
      const half = vert ? (label.includes(" ") ? 14 : 8) : ctx.measureText(label).width / 2;
      const from = vert ? x - 8 : x - half;
      const pillHalf = vert ? PILL.height / 2 : pill ? pill.w / 2 : 0;
      const underPill = pill && x + half > pill.x - pillHalf - 4 && from < pill.x + pillHalf + 4;
      if (!underPill && from > labelEnd + (vert ? 4 : 10)) {
        write(label, x, 46, "month");
        labelEnd = x + half;
      }
    }
  }

  // The unit under the playhead: accent tick and a pill ("26", "W39" or "SEP").
  if (pill) {
    const { x, label, w: pillW } = pill;
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x - 1.5, y - 16, 3, 32);
    ctx.font = `900 14px ${palette.font}`;
    if (vert) {
      // Left of the line, centred on the playhead.
      ctx.save();
      ctx.setTransform(vert.dpr, 0, 0, vert.dpr, 0, 0);
      const right = y - PILL_V.gap;
      ctx.beginPath();
      ctx.fillStyle = palette.accentFill;
      ctx.roundRect(right - pillW, x - PILL.height / 2, pillW, PILL.height, PILL.height / 2);
      ctx.fill();
      ctx.fillStyle = palette.onAccent;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, right - pillW / 2, x + 0.5);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.fillStyle = palette.accentFill;
      ctx.roundRect(x - pillW / 2, y + PILL.top, pillW, PILL.height, PILL.height / 2);
      ctx.fill();
      ctx.fillStyle = palette.onAccent;
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, y + PILL.top + PILL.height / 2 + 0.5);
      ctx.textBaseline = "top";
    }
  }
  ctx.globalAlpha = 1;
}

/** Vertical, Week: a Monday within 2 days of a month start gives its gutter place to the month label. */
function nearMonthStart(date: Date) {
  const d = date.getUTCDate();
  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return d <= 3 || d >= daysInMonth - 1;
}

/** Position, text and width of the playhead pill, or null in the TBA zone. */
function pillOf(v: TickView) {
  if (v.centerDay === null) return null;
  const date = dayToDate(v.centerDay);
  const label = v.zoom === "day" ? String(date.getUTCDate()) : v.zoom === "week" ? `W${isoWeek(date)}` : monthShort(date);
  v.ctx.font = `900 14px ${v.palette.font}`;
  return { x: Math.round((v.centerDay - v.startDay) * v.dayPx - v.left), label, w: Math.max(26, v.ctx.measureText(label).width + 14) };
}
