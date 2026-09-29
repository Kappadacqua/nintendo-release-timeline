import { SEASONS } from "../timeline/config";
import { dayToDate } from "../timeline/dates";
import { onScrollActivity } from "../timeline/scroller";
import { drawParticle, fadeIn, isGone, spawnParticle, stepParticle, type Palette, type Particle } from "./particles";
import { backgroundShown, leaveFade, particleCount, ScrollGate, seasonOf, SeasonState, type Season } from "./season";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const SEASON_NAMES: Season[] = ["winter", "spring", "summer", "autumn"];

/** What the timeline shows: the day under the playhead (null in the TBA zone) and whether a game is selected. */
export type TimelineProbe = () => { day: number | null; selected: boolean };

/**
 * Seasonal background (docs/tasks/seasons.md): particles of the season of the day under the
 * playhead, on one canvas behind line and cards. Hidden with a game selected and while
 * scrolling fast; the animation stops whenever nothing is shown.
 */
export class SeasonalBackground {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly season = new SeasonState();
  private readonly gate = new ScrollGate();
  private particles: Particle[] = [];
  private palette: Palette = { winter: "", spring: "", summer: "", autumn: "" };
  private alpha = 0.3;
  private width = 0;
  private height = 0;
  private max: number = SEASONS.minParticles;
  private shown = false;
  private frame = 0;
  private last = 0;
  private backTimer = 0;
  /** Season of the still canvas drawn with reduced motion. */
  private stillSeason: Season | null = null;
  private readonly cleanup: (() => void)[] = [];
  /** The band of the line (ticks, day numbers, months), in window y: particles never cross it. */
  private band: { el: HTMLElement; top: number; bottom: number } | null = null;

  constructor(
    private probe: TimelineProbe,
    /** The View menu setting (off by default with reduced motion). */
    private enabled = true,
  ) {
    const canvas = (this.canvas = document.createElement("canvas"));
    canvas.className = "seasons is-hidden";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
    this.ctx = canvas.getContext("2d")!;
    this.readPalette();
    this.resize();

    const listen = (target: EventTarget, type: string, fn: () => void) => {
      target.addEventListener(type, fn);
      this.cleanup.push(() => target.removeEventListener(type, fn));
    };
    listen(window, "resize", () => this.resize());
    listen(document, "visibilitychange", () => this.sync());
    listen(systemDark, "change", () => this.readPalette());
    listen(reducedMotion, "change", () => this.sync());
    const themeObserver = new MutationObserver(() => this.readPalette());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    this.cleanup.push(() => themeObserver.disconnect());
    const stopActivity = onScrollActivity({
      moved: () => this.gate.moved(performance.now()),
      fast: () => {
        this.gate.fast(performance.now());
        this.sync();
      },
    });
    this.cleanup.push(stopActivity);
    // Selection and the day under the playhead are also checked on every frame while shown;
    // this slow check notices them while the animation is stopped.
    const watch = setInterval(() => !this.frame && this.sync(), 250);
    this.cleanup.push(() => clearInterval(watch));
    this.sync();
  }

  /** Turns the whole background on or off. */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.sync();
  }

  destroy() {
    this.stop();
    clearTimeout(this.backTimer);
    this.cleanup.forEach((fn) => fn());
    this.canvas.remove();
  }

  /** Reads the timeline and decides whether the background shows and animates. */
  private sync(now = performance.now()) {
    // A rebuilt timeline (zoom, filters) has a new band.
    if (!this.band?.el.isConnected) this.readBand();
    const { day, selected } = this.probe();
    if (day !== null && this.season.set(seasonOf(dayToDate(Math.round(day))), now)) {
      // One season at a time: everything on screen starts fading out, the new season follows.
      for (const p of this.particles) p.leftAt ??= now;
    }
    const scrolling = !this.gate.shown(now);
    const shown =
      this.season.season !== null && backgroundShown({ enabled: this.enabled, selected, pageVisible: !document.hidden, scrolling });
    if (scrolling) this.scheduleBack();
    const appearing = shown && !this.shown;
    if (shown !== this.shown) {
      this.shown = shown;
      this.canvas.classList.toggle("is-hidden", !shown);
    }
    if (!shown) return this.stop();
    if (reducedMotion.matches) {
      // Reduced motion: a still decoration, redrawn only when something changes.
      this.stop();
      if (appearing || this.stillSeason !== this.season.season) this.drawStill(now);
    } else if (!this.frame) {
      this.last = now;
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  /** After fast scrolling: check again when the timeline should have been still for `restMs`. */
  private scheduleBack() {
    clearTimeout(this.backTimer);
    this.backTimer = window.setTimeout(() => this.sync(), Math.max(16, this.gate.backAt - performance.now()));
  }

  private stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private tick = (now: number) => {
    // `frame` still holds this callback's id, so sync() does not request a second one;
    // if it decides to stop, it clears it.
    this.sync(now);
    if (!this.shown || reducedMotion.matches) return;
    // A long pause (hidden, background tab) must not make particles jump.
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.step(dt, now);
    this.draw(now);
    this.frame = requestAnimationFrame(this.tick);
  };

  /** Moves every particle; the current season's are reborn at the edge, an old season's fade out. */
  private step(dt: number, now: number) {
    const season = this.season.season!;
    const t = now / 1000;
    let alive = 0;
    let reborn = 0;
    this.particles = this.particles.filter((p) => {
      if (leaveFade(p.leftAt, now) <= 0) return false;
      stepParticle(p, dt, t);
      const current = p.season === season && p.leftAt === undefined;
      if (isGone(p, this.width, this.height)) {
        if (current) reborn++;
        return false;
      }
      if (current) alive++;
      return true;
    });
    // Reborn ones enter from the edge; a season arriving appears anywhere, fading in.
    while (this.season.mayBirth(season, alive, this.max, now)) {
      const anywhere = reborn-- <= 0;
      this.particles.push(spawnParticle(season, this.width, this.height, now, anywhere));
      alive++;
    }
  }

  private draw(now: number) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    for (const p of this.particles) {
      ctx.globalAlpha = this.alpha * fadeIn(p, now) * leaveFade(p.leftAt, now);
      drawParticle(ctx, p, this.palette);
    }
    ctx.globalAlpha = 1;
    this.clearBand();
  }

  /**
   * Particles fade out across the band of the line, with soft edges: behind the thin line
   * and its labels they would look as if they crossed it in front.
   */
  private clearBand() {
    if (!this.band) return;
    const { ctx } = this;
    const f = SEASONS.bandFeatherPx;
    const top = this.band.top - f;
    const height = this.band.bottom - this.band.top + 2 * f;
    const mask = ctx.createLinearGradient(0, top, 0, top + height);
    const edge = f / height;
    mask.addColorStop(0, "rgb(0 0 0 / 0)");
    mask.addColorStop(edge, "#000");
    mask.addColorStop(1 - edge, "#000");
    mask.addColorStop(1, "rgb(0 0 0 / 0)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = mask;
    ctx.fillRect(0, top, this.width, height);
    ctx.globalCompositeOperation = "source-over";
  }

  private readBand() {
    const el = document.querySelector<HTMLElement>(".timeline__band");
    if (!el) return (this.band = null);
    const rect = el.getBoundingClientRect();
    this.band = rect.height ? { el, top: rect.top, bottom: rect.bottom } : null;
  }

  /** Reduced motion: the full number of the current season's particles, still. */
  private drawStill(now: number) {
    const season = this.season.season!;
    const current = this.particles.filter((p) => p.season === season && p.leftAt === undefined);
    while (current.length < this.max) current.push(spawnParticle(season, this.width, this.height, now - SEASONS.fadeInMs, true));
    this.particles = current.slice(0, this.max);
    this.stillSeason = season;
    this.draw(now);
  }

  private resize() {
    const dpr = Math.min(SEASONS.maxDpr, devicePixelRatio || 1);
    this.width = innerWidth;
    this.height = innerHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.max = particleCount(this.width, this.height);
    // The timeline moves its line on the same resize: read it once that is done.
    requestAnimationFrame(() => {
      this.readBand();
      this.redraw();
    });
    this.redraw();
  }

  /** Colours from tokens.css (`--season-<name>`, `--season-alpha`), per theme. */
  private readPalette() {
    const style = getComputedStyle(document.documentElement);
    for (const name of SEASON_NAMES) {
      this.palette[name] = style.getPropertyValue(`--season-${name}`).trim();
    }
    this.alpha = Number.parseFloat(style.getPropertyValue("--season-alpha")) || 0.3;
    this.redraw();
  }

  /** A still canvas (reduced motion, or stopped) is redrawn after a resize or a theme change. */
  private redraw() {
    if (this.shown && !this.frame && this.season.season) {
      if (reducedMotion.matches) this.drawStill(performance.now());
      else this.draw(performance.now());
    }
  }
}
