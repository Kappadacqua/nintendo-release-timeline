import { isVerticalSize } from "../layout";
import { SEASONS } from "../timeline/config";
import { dayToDate } from "../timeline/dates";
import { onScrollActivity } from "../timeline/scroller";
import { fadeIn, Gusts, isGone, spawnParticle, stepParticle, viewScale, WheelPush, wobbleX, type Palette, type Particle } from "./particles";
import { backgroundShown, particleCount, SEASON_NAMES, seasonOf, SeasonState, type Season } from "./season";
import { SpriteCache } from "./sprites";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const systemDark = matchMedia("(prefers-color-scheme: dark)");

/** What the timeline shows: the day under the playhead (null in the TBA zone) and whether a game is selected. */
export type TimelineProbe = () => { day: number | null; selected: boolean };

/**
 * Seasonal background (docs/tasks/seasons.md): particles of the season of the day under the
 * playhead, on one canvas behind line and cards; at a season change the two cross-fade.
 * Hidden with a game selected; a wheel spin pushes the particles sideways. The animation stops
 * whenever nothing is shown.
 */
export class SeasonalBackground {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly season = new SeasonState();
  private particles: Particle[] = [];
  private readonly gusts = new Gusts(performance.now());
  private readonly push = new WheelPush();
  private palette: Palette = { winter: "", spring: "", summer: "", autumn: "" };
  private readonly sprites = new SpriteCache(this.palette);
  private dpr = 1;
  private alpha = 0.3;
  private width = 0;
  private height = 0;
  private max: number = SEASONS.minParticles;
  private shown = false;
  private frame = 0;
  private last = 0;
  /** Season of the still canvas drawn with reduced motion. */
  private stillSeason: Season | null = null;
  private readonly cleanup: (() => void)[] = [];
  /** The band of the line (ticks, day numbers, months), in window y: particles never cross it. */
  private band: { el: HTMLElement; top: number; bottom: number; vertical: boolean; left: number; right: number } | null = null;

  constructor(
    private probe: TimelineProbe,
    /** The View menu setting (off by default with reduced motion). */
    private enabled = true,
  ) {
    const canvas = (this.canvas = document.createElement("canvas"));
    canvas.className = "seasons is-hidden";
    canvas.setAttribute("aria-hidden", "true");
    // After .backdrop (prepended on every rebuild): same z-index, so DOM order keeps the particles above it.
    document.body.append(canvas);
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
      wheelSpin: (dir) => {
        if (this.frame) this.push.notch(dir, performance.now());
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
    this.cleanup.forEach((fn) => fn());
    this.canvas.remove();
  }

  /** Reads the timeline and decides whether the background shows and animates. */
  private sync(now = performance.now()) {
    // A rebuilt timeline (zoom, filters) has a new band.
    if (!this.band?.el.isConnected) this.readBand();
    const { day, selected } = this.probe();
    // Reduced motion: the new season replaces the old one at once.
    if (day !== null) this.season.set(seasonOf(dayToDate(Math.round(day))), now, reducedMotion.matches);
    const shown = this.season.season !== null && backgroundShown({ enabled: this.enabled, selected, pageVisible: !document.hidden });
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

  private stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    // A push left over would make the particles jump when the background comes back.
    this.push.clear();
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

  /**
   * Moves every particle. Each season keeps target × its weight alive: the current one's are
   * reborn at the edge (or, while it rises, anywhere, fading in); a sinking season's
   * finish their path, fading with its weight, and are gone at weight 0.
   */
  private step(dt: number, now: number) {
    const current = this.season.season!;
    const alive = seasonCounts();
    const reborn = seasonCounts();
    this.particles = this.particles.filter((p) => {
      if (this.season.weight(p.season, now) <= 0) return false;
      const gust = p.season === "winter" ? this.gusts.velocity(p.depth, now) : 0;
      stepParticle(p, dt, gust + this.push.velocity(p.depth, now));
      if (isGone(p, this.width, this.height)) {
        reborn[p.season]++;
        return false;
      }
      alive[p.season]++;
      return true;
    });
    let total = this.particles.length;
    const cap = Math.floor(this.max * SEASONS.crossCap);
    // The current season first: the cap leaves the room to it.
    for (const season of [current, ...SEASON_NAMES.filter((s) => s !== current)]) {
      const target = this.season.target(season, this.max, now);
      // While a season rises its particles are born anywhere (fading in), not only at the edge.
      const rising = this.season.rising(season, now);
      let edge = reborn[season];
      while (alive[season] < target && total < cap && (season === current || edge > 0)) {
        this.particles.push(spawnParticle(season, this.width, this.height, now, edge-- <= 0 || rising));
        alive[season]++;
        total++;
      }
    }
  }

  private draw(now: number) {
    const { ctx } = this;
    const { dpr } = this;
    const t = now / 1000;
    const weight = this.season.weights(now);
    ctx.clearRect(0, 0, this.width, this.height);
    // Far band first, near band last.
    for (let depth = 0; depth < SEASONS.bands.length; depth++) {
      const bandAlpha = this.alpha * SEASONS.bands[depth].alpha;
      for (const p of this.particles) {
        if (p.depth !== depth) continue;
        const sprite = this.sprites.get(p);
        // Fixed tilt and size: the transform never changes over a particle's life.
        const k = dpr * p.scale;
        ctx.setTransform(k * p.cos, k * p.sin, -k * p.sin, k * p.cos, dpr * wobbleX(p, t), dpr * p.y);
        ctx.globalAlpha = bandAlpha * fadeIn(p, now) * weight[p.season];
        ctx.drawImage(sprite.canvas, -sprite.half, -sprite.half, sprite.half * 2, sprite.half * 2);
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    // Vertical timeline (SPEC "Mobile"): the band is a strip down the left side, faded on its right.
    if (this.band.vertical) {
      const width = this.band.right + f;
      const mask = ctx.createLinearGradient(0, 0, width, 0);
      mask.addColorStop(0, "#000");
      mask.addColorStop(1 - f / width, "#000");
      mask.addColorStop(1, "rgb(0 0 0 / 0)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = mask;
      ctx.fillRect(0, this.band.top, width, this.band.bottom - this.band.top);
      ctx.globalCompositeOperation = "source-over";
      return;
    }
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
    const vertical = !!el.closest(".is-vertical");
    this.band = rect.height ? { el, top: rect.top, bottom: rect.bottom, vertical, left: rect.left, right: rect.right } : null;
  }

  /** Reduced motion: the full number of the current season's particles, still. */
  private drawStill(now: number) {
    const season = this.season.season!;
    this.season.settle();
    const current = this.particles.filter((p) => p.season === season);
    while (current.length < this.max) current.push(spawnParticle(season, this.width, this.height, now - SEASONS.fadeInMs, true));
    this.particles = current.slice(0, this.max);
    this.stillSeason = season;
    this.draw(now);
  }

  private resize() {
    // Phones: a lighter canvas (SPEC "Mobile").
    const cap = isVerticalSize(innerWidth, innerHeight) ? SEASONS.phoneMaxDpr : SEASONS.maxDpr;
    const dpr = (this.dpr = Math.min(cap, devicePixelRatio || 1));
    this.width = innerWidth;
    this.height = innerHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.max = particleCount(this.width, this.height);
    this.sprites.setScale(dpr, viewScale(this.height, this.width));
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
    this.sprites.setPalette(this.palette);
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

const seasonCounts = (): Record<Season, number> => ({ winter: 0, spring: 0, summer: 0, autumn: 0 });
