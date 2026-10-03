import { SEASONS } from "../timeline/config";

/** Seasonal background logic (no DOM): season of a day, cross-fade weights, when it shows. */

export type Season = "winter" | "spring" | "summer" | "autumn";

/**
 * First day (Italian time) of spring, summer, autumn and winter: equinoxes and solstices, from USNO.
 * Months are 0-based, as in `getUTCMonth`.
 */
const SEASON_STARTS: Record<number, readonly [number, number, number, number]> = {
  2025: [20, 21, 22, 21],
  2026: [20, 21, 23, 21],
  2027: [20, 21, 23, 22],
  2028: [20, 20, 22, 21],
  2029: [20, 21, 22, 21],
  2030: [20, 21, 23, 21],
};
/** Years outside the table. */
const DEFAULT_STARTS = [20, 21, 22, 21] as const;
const START_MONTHS = [2, 5, 8, 11] as const;
const STARTING: readonly Season[] = ["spring", "summer", "autumn", "winter"];

/** Season from the equinox or solstice day it starts on (UTC fields of the day). */
export function seasonOf(date: Date): Season {
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const starts = SEASON_STARTS[date.getUTCFullYear()] ?? DEFAULT_STARTS;
  let season: Season = "winter";
  for (let i = 0; i < 4; i++) {
    if (m > START_MONTHS[i] || (m === START_MONTHS[i] && d >= starts[i])) season = STARTING[i];
  }
  return season;
}

/** 25–50 particles, growing linearly with the window area. */
export function particleCount(width: number, height: number) {
  const { minParticles: lo, maxParticles: hi, minArea, maxArea } = SEASONS;
  const t = (width * height - minArea) / (maxArea - minArea);
  return Math.round(lo + (hi - lo) * Math.min(1, Math.max(0, t)));
}

export const SEASON_NAMES: readonly Season[] = ["winter", "spring", "summer", "autumn"];

/** A weight moving from `from` to `to` over `ms`, starting at `start`. */
interface Ramp {
  from: number;
  to: number;
  start: number;
  ms: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

/**
 * The season on screen and the weight (0–1) of every season: at a change the new one rises to 1
 * after `crossDelayMs`, over `crossInMs` (ease-in-out), the others sink to 0 over `crossOutMs`
 * (linear), so the two overlap for a while. A weight always moves on from where it is: a season
 * coming back resumes from its current value. The very first season (or `immediate`) starts at once.
 */
export class SeasonState {
  season: Season | null = null;
  private ramps = new Map<Season, Ramp>();

  /** True when the season changed. */
  set(season: Season, now: number, immediate = false) {
    if (season === this.season) return false;
    const first = this.season === null;
    this.season = season;
    if (first || immediate) {
      this.settle();
      return true;
    }
    for (const name of SEASON_NAMES) {
      const w = this.weight(name, now);
      if (name === season) {
        this.ramps.set(name, { from: w, to: 1, start: now + SEASONS.crossDelayMs, ms: SEASONS.crossInMs * (1 - w) });
      } else if (w > 0) {
        this.ramps.set(name, { from: w, to: 0, start: now, ms: SEASONS.crossOutMs * w });
      } else {
        // Also drops a rise still waiting for its delay.
        this.ramps.delete(name);
      }
    }
    return true;
  }

  /** Ends any transition: the current season at 1, the others at 0. */
  settle() {
    this.ramps.clear();
    if (this.season) this.ramps.set(this.season, { from: 1, to: 1, start: -Infinity, ms: 0 });
  }

  /** Weight of `season` at `now`. */
  weight(season: Season, now: number) {
    const r = this.ramps.get(season);
    if (!r) return 0;
    if (now <= r.start) return r.from;
    if (now >= r.start + r.ms) return r.to;
    const t = (now - r.start) / r.ms;
    return r.from + (r.to - r.from) * (r.to > r.from ? easeInOut(t) : t);
  }

  weights(now: number): Record<Season, number> {
    const w = {} as Record<Season, number>;
    for (const name of SEASON_NAMES) w[name] = this.weight(name, now);
    return w;
  }

  /** True while `season` is still rising to full weight. */
  rising(season: Season, now: number) {
    const r = this.ramps.get(season);
    return !!r && r.to > r.from && now < r.start + r.ms;
  }

  /** How many particles of `season` should be alive at `now`, out of `max`. */
  target(season: Season, max: number, now: number) {
    return Math.floor(max * this.weight(season, now));
  }
}

/** Visible (drawn, animating): enabled, no game selected, page visible (also while scrolling fast). */
export function backgroundShown(s: { enabled: boolean; selected: boolean; pageVisible: boolean }) {
  return s.enabled && !s.selected && s.pageVisible;
}
