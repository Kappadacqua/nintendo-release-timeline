import { TIMELINE } from "./config";
import { dayToDate, MONTHS } from "./dates";
import { isoWeek, type ZoomLevel } from "./zoom";

export interface TickPalette {
  tick: string;
  label: string;
  accent: string;
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
}

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
    if (half) {
      ctx.fillStyle = palette.tick;
      ctx.fillRect(x - w / 2, y - half, w, half * 2);
    }

    // Small labels under the line: day numbers, or week numbers.
    const isCenter = day === v.centerDay;
    ctx.fillStyle = palette.label;
    ctx.font = `700 11px ${palette.font}`;
    if (v.zoom === "day" && !isCenter && TIMELINE.labeledDays.includes(date.getUTCDate())) {
      ctx.fillText(String(date.getUTCDate()), x, y + 27);
    } else if (v.zoom === "week" && monday && !isCenter) {
      ctx.fillText(`W${isoWeek(date)}`, x, y + 27);
    }

    // Month labels (with the year in January, and the full date at the very start).
    if (monthStart || i === 0) {
      const month = monthShort(date);
      const label =
        i === 0 ? `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}` : date.getUTCMonth() === 0 ? `${month} ${date.getUTCFullYear()}` : month;
      ctx.font = `800 13px ${palette.font}`;
      const half = ctx.measureText(label).width / 2;
      const underPill = pill && x + half > pill.x - pill.w / 2 - 4 && x - half < pill.x + pill.w / 2 + 4;
      if (!underPill && x - half > labelEnd + 10) {
        ctx.fillText(label, x, y + 46);
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
    ctx.beginPath();
    ctx.roundRect(x - pillW / 2, y + 22, pillW, 22, 11);
    ctx.fill();
    ctx.fillStyle = palette.onAccent;
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y + 33.5);
    ctx.textBaseline = "top";
  }
  ctx.globalAlpha = 1;
}

/** Position, text and width of the playhead pill, or null in the TBA zone. */
function pillOf(v: TickView) {
  if (v.centerDay === null) return null;
  const date = dayToDate(v.centerDay);
  const label = v.zoom === "day" ? String(date.getUTCDate()) : v.zoom === "week" ? `W${isoWeek(date)}` : monthShort(date);
  v.ctx.font = `900 14px ${v.palette.font}`;
  return { x: Math.round((v.centerDay - v.startDay) * v.dayPx - v.left), label, w: Math.max(26, v.ctx.measureText(label).width + 14) };
}
