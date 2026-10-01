import { SEASONS } from "../timeline/config";
import { KIND_SIZE, SEASON_KINDS, variantCount, type Kind, type Palette, type Particle } from "./particles";
import type { Season } from "./season";

/**
 * Pre-rendered particle sprites (docs/tasks/seasons-art.md task 1): every kind × variant × depth
 * band is drawn once on an offscreen canvas in the drawn style (round outline, light fill of the
 * same colour, thinner veins, a second offset "pencil" outline), then reused with `drawImage`.
 */

/** Deterministic random numbers (mulberry32). */
export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shape of size `s` (px) centred on the origin: outline, optional veins, half extent (px). */
interface Shape {
  outline: Path2D;
  veins?: Path2D;
  /** Whether the outline is closed and gets the light fill. */
  fill: boolean;
  extent: number;
}

type Point = [number, number];
/** `[x, y]` turned by `a` (rad) and moved by `dx`, `dy`. */
const turn = ([x, y]: Point, a: number, dx = 0, dy = 0): Point => [x * Math.cos(a) - y * Math.sin(a) + dx, x * Math.sin(a) + y * Math.cos(a) + dy];

/** Path commands recorded in leaf units, so the drawing can be measured and centred first. */
type Command = { move: Point } | { line: Point } | { quad: [Point, Point] };

/**
 * Pen of a leaf (docs/tasks/seasons-art.md task 3), in units of the leaf length L with the base of
 * the blade at the origin and the tip up. Every point is moved by ± `SEASONS.leaves.jitter` and the
 * whole leaf is bent sideways a little (`x += bend · y²`), so no two variants match.
 */
class LeafPen {
  readonly outline: Command[] = [];
  readonly veins: Command[] = [];
  constructor(
    private rand: () => number,
    private bend: number,
  ) {}

  /** A control point: jittered, then bent. */
  at([x, y]: Point): Point {
    const j = SEASONS.leaves.jitter;
    const jx = x * (1 + (this.rand() * 2 - 1) * j);
    const jy = y * (1 + (this.rand() * 2 - 1) * j);
    return [jx + this.bend * jy * jy, jy];
  }

  /** A curved stem `length` long hanging from the base of the blade (`from`). */
  stem(length: number, from: Point = [0, 0]) {
    const side = this.rand() < 0.5 ? -1 : 1;
    const sway = 0.15 + 0.15 * this.rand();
    const [x, y] = from;
    this.veins.push({ move: [x, y] }, { quad: [[x + side * sway * length, y + length * 0.5], [x + side * sway * 0.3 * length, y + length]] });
  }

  /** A curved vein from `a` to `b`, bowed through `c`. */
  vein(a: Point, c: Point, b: Point) {
    this.veins.push({ move: this.at(a) }, { quad: [this.at(c), this.at(b)] });
  }

  /** The shape, `length` px long and centred on its bounding box. */
  shape(length: number): Shape {
    const all = [...this.outline, ...this.veins].flatMap((c) => ("move" in c ? [c.move] : "line" in c ? [c.line] : c.quad));
    const xs = all.map(([x]) => x);
    const ys = all.map(([, y]) => y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const half = Math.max(Math.max(...xs) - cx, Math.max(...ys) - cy);
    const px = ([x, y]: Point): Point => [(x - cx) * length, (y - cy) * length];
    const draw = (commands: Command[]) => {
      const path = new Path2D();
      for (const c of commands) {
        if ("move" in c) path.moveTo(...px(c.move));
        else if ("line" in c) path.lineTo(...px(c.line));
        else path.quadraticCurveTo(...px(c.quad[0]), ...px(c.quad[1]));
      }
      return path;
    };
    const outline = draw(this.outline);
    outline.closePath();
    return { outline, veins: draw(this.veins), fill: true, extent: half * length };
  }
}

/** A point `r` from the origin in the direction `deg` degrees from straight up (clockwise). */
const polar = (deg: number, r: number): Point => [r * Math.sin((deg * Math.PI) / 180), -r * Math.cos((deg * Math.PI) / 180)];
const mix = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A new leaf pen with a random bend. */
const leafPen = (rand: () => number) => new LeafPen(rand, (rand() * 2 - 1) * 0.18);

/**
 * Irregular five-lobed maple: middle lobe 0.5 L, upper lobes at ±40° 0.42 L, lower lobes at ±85°
 * 0.26 L, 2–3 teeth per lobe, rounded sinuses, stem 0.28 L.
 */
function maple(s: number, rand: () => number): Shape {
  const pen = leafPen(rand);
  const lobes = [
    { deg: -85, len: 0.26 },
    { deg: -40, len: 0.42 },
    { deg: 0, len: 0.5 },
    { deg: 40, len: 0.42 },
    { deg: 85, len: 0.26 },
  ];
  /** Points from `from` to `to` along one edge of a lobe, with `n` teeth pointing `out`. */
  const edge = (from: Point, to: Point, n: number, out: Point, size: number) => {
    const points: Point[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.6 + (rand() - 0.5) * 0.3) / (n + 0.6);
      const [x, y] = mix(from, to, t);
      const [bx, by] = mix(from, to, t + 0.04);
      // Up the edge, out to the point of the tooth, back in just past it.
      points.push(mix(from, to, t - 0.1), [x + out[0] * size, y + out[1] * size], [bx - out[0] * size * 0.3, by - out[1] * size * 0.3]);
    }
    return points;
  };
  const shoulders = lobes.map(({ deg, len }, i) => {
    const before = i ? (deg - lobes[i - 1].deg) / 2 : 25;
    const after = i < lobes.length - 1 ? (lobes[i + 1].deg - deg) / 2 : 25;
    const r = Math.min(0.24, 0.6 * len);
    return [polar(deg - Math.min(before, 25) * 0.85, r), polar(deg + Math.min(after, 25) * 0.85, r)];
  });
  pen.outline.push({ move: pen.at(shoulders[0][0]) });
  lobes.forEach(({ deg, len }, i) => {
    const tip = polar(deg, len);
    const teeth = 2 + (rand() < 0.5 ? 1 : 0);
    const left = rand() < 0.5 ? Math.floor(teeth / 2) : Math.ceil(teeth / 2);
    const size = 0.09 * len;
    const [l, r] = shoulders[i];
    const points = [
      ...edge(l, tip, left, polar(deg - 90, 1), size),
      tip,
      ...edge(r, tip, teeth - left, polar(deg + 90, 1), size).reverse(),
      r,
    ];
    for (const p of points) pen.outline.push({ line: pen.at(p) });
    // Rounded sinus to the next lobe (the last one goes round the base, where the stem is).
    const next = shoulders[i + 1]?.[0] ?? shoulders[0][0];
    const sinus = i < lobes.length - 1 ? polar((deg + lobes[i + 1].deg) / 2, 0.13) : ([0, 0] as Point);
    pen.outline.push({ quad: [pen.at(sinus), pen.at(next)] });
  });
  // A vein to every lobe, a side vein off each upper one.
  for (const { deg, len } of lobes) pen.vein([0, 0.02], polar(deg, len * 0.45), polar(deg + (rand() - 0.5) * 6, len * 0.85));
  for (const side of [-1, 1]) pen.vein(polar(side * 40, 0.16), polar(side * 44, 0.22), polar(side * 50, 0.28));
  pen.stem(0.28, [0, 0.03]);
  return pen.shape(s * 2);
}

/** One side of a blade from the base to the tip: the anchors, each with the control point before it. */
type Side = { p: Point; c?: Point }[];

/** Outline of a blade from its right side and its left side, both drawn base → tip on the right. */
function blade(pen: LeafPen, right: Side, left: Side) {
  const mirrored = left.map(({ p, c }) => ({ p: [-p[0], p[1]] as Point, c: c && ([-c[0], c[1]] as Point) }));
  pen.outline.push({ move: pen.at(right[0].p) });
  for (const { p, c } of right.slice(1)) pen.outline.push(c ? { quad: [pen.at(c), pen.at(p)] } : { line: pen.at(p) });
  // Back down the left side: each control point belongs to the segment ending at the anchor.
  for (let i = mirrored.length - 1; i > 0; i--) {
    const { c } = mirrored[i];
    const p = mirrored[i - 1].p;
    pen.outline.push(c ? { quad: [pen.at(c), pen.at(p)] } : { line: pen.at(p) });
  }
}

/** Lobed oak: elongated oval 0.55 L wide, 3–4 rounded lobes per side of alternating depth, stem 0.12 L. */
function oak(s: number, rand: () => number): Shape {
  const pen = leafPen(rand);
  const width = (t: number) => 0.275 * Math.sin(Math.PI * (0.08 + 0.84 * t)) ** 0.7;
  const lobeTips: Point[] = [];
  const side = (): Side => {
    const n = 3 + (rand() < 0.5 ? 1 : 0);
    const deep = rand() < 0.5 ? 0 : 1;
    const step = 0.8 / n;
    const points: Side = [{ p: [0, 0] }];
    for (let i = 0; i < n; i++) {
      const ts = 0.1 + i * step;
      const depth = i % 2 === deep ? 0.55 : 0.3;
      points.push({ p: [width(ts) * (1 - depth), -ts] });
      const tl = ts + step / 2;
      const tip: Point = [width(tl) * 1.4, -tl];
      lobeTips.push(tip);
      points.push({ c: tip, p: [width(ts + step) * (1 - (i % 2 === deep ? 0.3 : 0.55)), -(ts + step)] });
    }
    points.push({ c: [width(0.97) * 1.1, -1.02], p: [0, -1] });
    return points;
  };
  const right = side();
  const tipsRight = lobeTips.length;
  blade(pen, right, side());
  pen.vein([0, 0], [0, -0.5], [0, -0.9]);
  lobeTips.forEach(([x, y], i) => {
    const sign = i < tipsRight ? 1 : -1;
    pen.vein([0, y + 0.08], [sign * x * 0.3, y + 0.02], [sign * x * 0.55, y - 0.01]);
  });
  pen.stem(0.12);
  return pen.shape(s * 2);
}

/** Birch: ovate, 0.7 L wide, pointed tip, about 14 small teeth along the edge, stem 0.2 L. */
function birch(s: number, rand: () => number): Shape {
  const pen = leafPen(rand);
  const width = (t: number) => 0.35 * Math.sin(Math.PI * Math.min(1, t) ** 0.75);
  const side = (): Side => {
    const n = 6 + Math.floor(rand() * 3);
    const points: Side = [{ p: [0, 0] }];
    for (let i = 0; i < n; i++) {
      const t = 0.08 + ((i + 1) / (n + 1)) * 0.86;
      // A notch, then a small tooth pointing toward the tip.
      points.push({ p: [width(t - 0.04) * 0.96, -(t - 0.04)] }, { p: [width(t) + 0.025, -(t + 0.015)] });
    }
    points.push({ p: [0, -1] });
    return points;
  };
  blade(pen, side(), side());
  pen.vein([0, 0], [0, -0.5], [0, -0.9]);
  for (const t of [0.14, 0.3, 0.46, 0.62]) {
    for (const sign of [-1, 1]) pen.vein([0, -t], [sign * width(t) * 0.4, -(t + 0.05)], [sign * width(t + 0.12) * 0.72, -(t + 0.12)]);
  }
  pen.stem(0.2);
  return pen.shape(s * 2);
}

/** Ginkgo: a fan opening ~150°, 1.1 L wide, with a central notch 0.45 L deep, 7 radial veins, stem 0.4 L. */
function ginkgo(s: number, rand: () => number): Shape {
  const pen = leafPen(rand);
  const half = 75;
  const r = 0.55 / Math.sin((half * Math.PI) / 180);
  const notch = r - 0.45;
  const wavy = () => r * (1 + (rand() * 2 - 1) * 0.03);
  /** The wavy rim from `a` to `b` degrees. */
  const rim = (a: number, b: number) => {
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const d0 = a + ((b - a) * (i - 1)) / n;
      const d1 = a + ((b - a) * i) / n;
      pen.outline.push({ quad: [pen.at(polar((d0 + d1) / 2, wavy() * 1.02)), pen.at(polar(d1, wavy()))] });
    }
  };
  pen.outline.push({ move: [0, 0] }, { quad: [pen.at(polar(-half + 18, r * 0.5)), pen.at(polar(-half, r))] });
  rim(-half, -6);
  pen.outline.push(
    { line: pen.at(polar(-3, notch + 0.05)) },
    { quad: [pen.at(polar(0, notch - 0.02)), pen.at(polar(3, notch + 0.05))] },
    { line: pen.at(polar(6, r)) },
  );
  rim(6, half);
  pen.outline.push({ quad: [pen.at(polar(half - 18, r * 0.5)), [0, 0]] });
  for (let i = 0; i < 7; i++) {
    const deg = -60 + i * 20;
    // The middle vein stops at the notch.
    const end = deg ? r * 0.88 : notch - 0.03;
    pen.vein(polar(deg * 0.2, 0.04), polar(deg * 0.8, end * 0.5), polar(deg, end));
  }
  pen.stem(0.4);
  return pen.shape(s * 2);
}

/**
 * A petal `r` long and `w` · r wide with the cherry notch at its tip, its base at (`dx`, `dy`)
 * and pointing up turned by `a`.
 */
function petalPath(path: Path2D, r: number, w: number, a = 0, dx = 0, dy = 0) {
  const at = (x: number, y: number) => turn([x * r, y * r], a, dx, dy);
  path.moveTo(...at(0, 0));
  path.quadraticCurveTo(...at(-w, -0.45), ...at(-0.44 * w, -1));
  path.lineTo(...at(0, -0.84));
  path.lineTo(...at(0.44 * w, -1));
  path.quadraticCurveTo(...at(w, -0.45), ...at(0, 0));
  path.closePath();
}

function petal(s: number): Shape {
  const outline = new Path2D();
  // Centred: base below the origin, tip above.
  petalPath(outline, s, 0.6, 0, 0, s / 2);
  return { outline, fill: true, extent: s * 0.6 };
}

/** Five notched petals around a small centre with five stamens. */
function blossom(s: number): Shape {
  const outline = new Path2D();
  // Narrower than a single petal, so the five just touch.
  for (let i = 0; i < 5; i++) petalPath(outline, s, 0.42, (i * Math.PI * 2) / 5);
  const veins = new Path2D();
  veins.moveTo(s * 0.14, 0);
  veins.arc(0, 0, s * 0.14, 0, Math.PI * 2);
  for (let i = 0; i < 5; i++) {
    const a = ((i + 0.5) * Math.PI * 2) / 5;
    veins.moveTo(Math.cos(a) * s * 0.14, Math.sin(a) * s * 0.14);
    veins.lineTo(Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42);
  }
  return { outline, veins, fill: true, extent: s };
}

/** Six arms, each with a pair of small branches, around a small hexagon (lines only). */
function flake(s: number): Shape {
  const outline = new Path2D();
  const b = s * 0.3;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const at = (along: number, across: number) => turn([along, across], a);
    outline.moveTo(...at(s * 0.2, 0));
    outline.lineTo(...at(s, 0));
    outline.moveTo(...at(s * 0.55 + b, b));
    outline.lineTo(...at(s * 0.55, 0));
    outline.lineTo(...at(s * 0.55 + b, -b));
    // Side of the central hexagon.
    const n = ((i + 1) * Math.PI) / 3;
    outline.moveTo(Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.2);
    outline.lineTo(Math.cos(n) * s * 0.2, Math.sin(n) * s * 0.2);
  }
  return { outline, fill: false, extent: s };
}

/** A circle with two glints: a short arc inside on the upper left, a smaller one opposite. */
function bubble(s: number): Shape {
  const outline = new Path2D();
  outline.arc(0, 0, s, 0, Math.PI * 2);
  const veins = new Path2D();
  veins.moveTo(Math.cos(Math.PI * 1.1) * s * 0.68, Math.sin(Math.PI * 1.1) * s * 0.68);
  veins.arc(0, 0, s * 0.68, Math.PI * 1.1, Math.PI * 1.45);
  veins.moveTo(Math.cos(Math.PI * 0.15) * s * 0.72, Math.sin(Math.PI * 0.15) * s * 0.72);
  veins.arc(0, 0, s * 0.72, Math.PI * 0.15, Math.PI * 0.25);
  return { outline, veins, fill: true, extent: s };
}

/** Shape builders; `rand` (seeded per variant) is for the shapes that vary. */
const SHAPES: Record<Kind, (s: number, rand: () => number) => Shape> = { maple, oak, birch, ginkgo, petal, blossom, flake, bubble };

/** A sprite and its half size in CSS px (it is drawn centred on the particle). */
export interface Sprite {
  canvas: HTMLCanvasElement;
  half: number;
}

/** Room around the shape for the outline and the pencil stroke (px). */
const MARGIN = 3;

function renderSprite(kind: Kind, variant: number, depth: number, color: string, dpr: number, view: number): Sprite {
  const band = SEASONS.bands[depth];
  const style = SEASONS.sprite;
  // The same seed gives the same variant on every start, whatever the band or the theme.
  const rand = mulberry32(SEASONS.spriteSeed + Object.keys(SHAPES).indexOf(kind) * 97 + variant * 7919);
  const pencilAngle = rand() * Math.PI * 2;
  const pencilPx = style.pencilPx[0] + (style.pencilPx[1] - style.pencilPx[0]) * rand();
  const shape = SHAPES[kind](KIND_SIZE[kind] * band.size * view, rand);
  const half = Math.ceil(shape.extent + MARGIN);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.ceil(half * 2 * dpr);
  const g = canvas.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, canvas.width / 2, canvas.height / 2);
  g.strokeStyle = g.fillStyle = color;
  g.lineCap = g.lineJoin = "round";
  if (shape.fill) {
    g.globalAlpha = style.fillAlpha;
    g.fill(shape.outline);
  }
  g.globalAlpha = 1;
  g.lineWidth = band.linePx;
  g.stroke(shape.outline);
  if (shape.veins) {
    g.globalAlpha = style.veinAlpha;
    g.lineWidth = band.linePx * style.veinWidth;
    g.stroke(shape.veins);
  }
  g.globalAlpha = style.pencilAlpha;
  g.lineWidth = band.linePx;
  g.translate(Math.cos(pencilAngle) * pencilPx, Math.sin(pencilAngle) * pencilPx);
  g.stroke(shape.outline);
  return { canvas, half };
}

/**
 * Sprites of the seasons on screen, built the first time one of their particles is drawn.
 * Cleared when the colours (theme) or the pixel density / window scale change.
 */
export class SpriteCache {
  private sprites = new Map<Season, Sprite[]>();
  private dpr = 1;
  private view = 1;

  constructor(private palette: Palette) {}

  /** New colours: every sprite is drawn again. */
  setPalette(palette: Palette) {
    this.palette = palette;
    this.sprites.clear();
  }

  /** New pixel density or window scale: every sprite is drawn again. */
  setScale(dpr: number, view: number) {
    if (dpr === this.dpr && view === this.view) return;
    this.dpr = dpr;
    this.view = view;
    this.sprites.clear();
  }

  get(p: Particle): Sprite {
    let list = this.sprites.get(p.season);
    if (!list) this.sprites.set(p.season, (list = this.build(p.season)));
    return list[spriteIndex(p.season, p.kind, p.variant, p.depth)];
  }

  private build(season: Season) {
    const list: Sprite[] = [];
    for (const kind of SEASON_KINDS[season]) {
      for (let variant = 0; variant < variantCount(kind); variant++) {
        for (let depth = 0; depth < SEASONS.bands.length; depth++) {
          list.push(renderSprite(kind, variant, depth, this.palette[season], this.dpr, this.view));
        }
      }
    }
    return list;
  }
}

/** Position of a sprite in its season's list (kinds, then variants, then bands). */
function spriteIndex(season: Season, kind: Kind, variant: number, depth: number) {
  let i = 0;
  for (const k of SEASON_KINDS[season]) {
    if (k === kind) break;
    i += variantCount(k) * SEASONS.bands.length;
  }
  return i + variant * SEASONS.bands.length + depth;
}
