import { SEASONS } from "../timeline/config";

/** Seasonal background logic (no DOM): season of a day, change ramp, when it shows. */

export type Season = "winter" | "spring" | "summer" | "autumn";

/** Whole months: winter Dec–Feb, spring Mar–May, summer Jun–Aug, autumn Sep–Nov (UTC fields). */
export function seasonOf(date: Date): Season {
  const m = date.getUTCMonth();
  if (m === 11 || m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}

/** 20–40 particles, growing linearly with the window area. */
export function particleCount(width: number, height: number) {
  const { minParticles: lo, maxParticles: hi, minArea, maxArea } = SEASONS;
  const t = (width * height - minArea) / (maxArea - minArea);
  return Math.round(lo + (hi - lo) * Math.min(1, Math.max(0, t)));
}

/**
 * The season on screen. After a change, particles of the old one only finish their path
 * (no new births) and the new one's appear gradually: its target number ramps up over `rampMs`.
 */
export class SeasonState {
  season: Season | null = null;
  private changedAt = -Infinity;

  /** True when the season changed. */
  set(season: Season, now: number) {
    if (season === this.season) return false;
    this.season = season;
    this.changedAt = now;
    return true;
  }

  /** How many particles of the current season should be alive at `now`, out of `max`. */
  target(max: number, now: number) {
    const t = Math.min(1, Math.max(0, (now - this.changedAt) / SEASONS.rampMs));
    return Math.floor(max * t);
  }

  /** May a particle of `season` be born (or reborn) at `now`, with `alive` of that season around? */
  mayBirth(season: Season, alive: number, max: number, now: number) {
    return season === this.season && alive < this.target(max, now);
  }
}

/**
 * Fast scrolling (wheel gear 2+, quick drag, long jump) hides the background; it comes back
 * `restMs` after the timeline last moved.
 */
export class ScrollGate {
  private movedAt = -Infinity;
  private hidden = false;

  fast(now: number) {
    this.hidden = true;
    this.movedAt = Math.max(this.movedAt, now);
  }

  moved(now: number) {
    this.movedAt = Math.max(this.movedAt, now);
  }

  /** Shown at `now`? */
  shown(now: number) {
    if (this.hidden && now - this.movedAt >= SEASONS.restMs) this.hidden = false;
    return !this.hidden;
  }

  /** When it comes back if nothing moves any more. */
  get backAt() {
    return this.hidden ? this.movedAt + SEASONS.restMs : -Infinity;
  }
}

/** Visible (drawn, animating): enabled, no game selected, page visible, not fast scrolling. */
export function backgroundShown(s: { enabled: boolean; selected: boolean; pageVisible: boolean; scrolling: boolean }) {
  return s.enabled && !s.selected && s.pageVisible && !s.scrolling;
}
