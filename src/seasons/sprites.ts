import { SEASONS } from "../timeline/config";
import { CLUSTER_SPAN, KIND_SIZE, kindRadius, SEASON_KINDS, variantCount, type Kind, type Palette, type Particle } from "./particles";
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
  /** Opacity of that fill, if not `SEASONS.sprite.fillAlpha`. */
  fillAlpha?: number;
  /** An open branch under the outline, drawn `SEASONS.spring.sprig.branchPx` wide. */
  branch?: Path2D;
  extent: number;
  /** A soft filled dot of this radius instead of strokes. */
  dot?: number;
  /** Bubbles `[x, y, r]`: a radial fill each instead of the flat one. */
  bubbles?: [number, number, number][];
  /** Small dots filled at the veins' opacity (glints, a starfish's rows). */
  spots?: Path2D;
  /** A light fill under everything (a fir twig's needles as one mass), at `fillAlpha`. */
  mass?: Path2D;
  /** Outline and vein widths (px), if not the band's. */
  outlinePx?: number;
  veinPx?: number;
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
    /** How far each point moves (± share); shells use less than leaves. */
    private jitter: number = SEASONS.leaves.jitter,
  ) {}

  /** A control point: jittered, then bent. */
  at([x, y]: Point): Point {
    const j = this.jitter;
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

/** A petal form, in units of its length: half width, notch half width (× the width) and depth, skew. */
interface PetalForm {
  w: number;
  notch: number;
  depth: number;
  /** Asymmetry: one side wider than the other by ± this share, the tip moved toward it. */
  skew?: number;
}

/** Cherry petal: notch at the tip. */
const CHERRY: PetalForm = { w: 0.42, notch: 0.44, depth: 0.16 };

/**
 * A petal `r` long in `form`, its base at (`dx`, `dy`) and pointing up turned by `a`
 * (`notch` 0: a plain petal with a pointed tip).
 */
function petalPath(path: Path2D, r: number, form: PetalForm, a = 0, dx = 0, dy = 0) {
  const at = (x: number, y: number) => turn([x * r, y * r], a, dx, dy);
  const skew = form.skew ?? 0;
  const left = form.w * (1 - skew);
  const right = form.w * (1 + skew);
  const tip = skew * 0.2;
  path.moveTo(...at(0, 0));
  path.quadraticCurveTo(...at(-left, -0.45), ...at(tip - form.notch * left, -1));
  if (form.notch) {
    path.lineTo(...at(tip, -1 + form.depth));
    path.lineTo(...at(tip + form.notch * right, -1));
  }
  path.quadraticCurveTo(...at(right, -0.45), ...at(0, 0));
  path.closePath();
}

/** The three single-petal silhouettes: narrow notch, wide notch, lopsided. */
const PETALS: PetalForm[] = [
  { w: 0.6, notch: 0.2, depth: 0.1 },
  { w: 0.64, notch: 0.5, depth: 0.2 },
  { w: 0.58, notch: 0.38, depth: 0.15, skew: 0.25 },
];

/** A path that starts a new subpath on the circle or ellipse (no line from the previous point). */
function ellipse(path: Path2D, x: number, y: number, rx: number, ry: number, a = 0) {
  path.moveTo(...turn([rx, 0], a, x, y));
  path.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
}

/**
 * Single petal `2s` long with the notch at its tip: one of three silhouettes and one of two fill
 * opacities per variant, the width ± 8 %; a faint middle vein.
 */
function petal(s: number, rand: () => number, variant: number): Shape {
  const base = PETALS[variant % PETALS.length];
  const form = { ...base, w: base.w * (1 + (rand() * 2 - 1) * 0.08) };
  const outline = new Path2D();
  // Centred: base below the origin, tip above.
  petalPath(outline, s * 2, form, 0, 0, s);
  const veins = new Path2D();
  veins.moveTo(0, s * 0.85);
  veins.quadraticCurveTo(s * (rand() - 0.5) * 0.12, s * 0.3, 0, -s * 0.15);
  const [low, high] = SEASONS.spring.petalFillAlpha;
  return { outline, veins, fill: true, fillAlpha: variant < PETALS.length ? low : high, extent: s * 1.05 };
}

/**
 * Whole cherry blossom of radius `s`: five notched petals (each a little longer or shorter, a
 * little off its place), a ring at the centre and 8–10 stamens ending in a dot.
 */
function blossom(s: number, rand: () => number): Shape {
  const outline = new Path2D();
  const turn0 = rand() * Math.PI * 2;
  // Narrower than a single petal, so the five just touch.
  for (let i = 0; i < 5; i++) {
    const a = turn0 + ((i + (rand() - 0.5) * 0.12) * Math.PI * 2) / 5;
    petalPath(outline, s * (0.9 + 0.1 * rand()), CHERRY, a);
  }
  const veins = new Path2D();
  const ring = s * 0.15;
  ellipse(veins, 0, 0, ring, ring);
  const stamens = 8 + Math.floor(rand() * 3);
  for (let i = 0; i < stamens; i++) {
    const a = ((i + (rand() - 0.5) * 0.4) * Math.PI * 2) / stamens;
    const end = s * (0.4 + 0.1 * rand());
    veins.moveTo(...turn([ring, 0], a));
    veins.lineTo(...turn([end, 0], a));
    const [x, y] = turn([end + s * 0.035, 0], a);
    ellipse(veins, x, y, s * 0.035, s * 0.035);
  }
  return { outline, veins, fill: true, extent: s };
}

/**
 * Flowering sprig about `2s` long, tip up: a curved branch (drawn `SEASONS.spring.sprig.branchPx`
 * wide), 2–3 small blossoms and 2–3 oval buds on short stalks on alternating sides, a bud at the tip.
 */
function sprig(s: number, rand: () => number): Shape {
  const bow = (rand() * 2 - 1) * 0.15 * s;
  /** Point of the branch at `t` (0 base, 1 tip). */
  const stem = (t: number): Point => [bow * 4 * t * (1 - t), 0.9 * s - 1.7 * s * t];
  const branch = new Path2D();
  branch.moveTo(...stem(0));
  branch.quadraticCurveTo(bow * 2, 0.05 * s, ...stem(1));
  // Small flowers: `flowerScale` × a blossom of the middle band.
  const flower = s * SEASONS.spring.sprig.flowerScale * (KIND_SIZE.blossom / KIND_SIZE.sprig);
  const outline = new Path2D();
  const veins = new Path2D();
  const addBud = (from: Point, a: number) => {
    const half = flower * 0.5;
    const [x, y] = turn([0, -(s * 0.05 + half)], a, ...from);
    veins.moveTo(...from);
    veins.lineTo(...turn([0, -s * 0.06], a, ...from));
    ellipse(outline, x, y, flower * 0.3, half, a);
  };
  const flowers = 2 + Math.floor(rand() * 2);
  const items = [...Array<boolean>(flowers).fill(true), ...Array<boolean>(1 + Math.floor(rand() * 2)).fill(false)];
  // Shuffled along the branch, so no two variants put flowers in the same places.
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  const side0 = rand() < 0.5 ? -1 : 1;
  items.forEach((isFlower, i) => {
    const t = 0.2 + (0.62 * (i + 0.5)) / items.length;
    const from = stem(t);
    const a = (i % 2 ? side0 : -side0) * ((50 + 20 * rand()) * Math.PI) / 180;
    if (!isFlower) return addBud(from, a);
    const centre = turn([0, -(s * 0.06 + flower)], a, ...from);
    veins.moveTo(...from);
    veins.lineTo(...turn([0, -s * 0.06], a, ...from));
    const spin = rand() * Math.PI * 2;
    for (let k = 0; k < 5; k++) petalPath(outline, flower, CHERRY, spin + (k * Math.PI * 2) / 5, ...centre);
    ellipse(veins, ...centre, flower * 0.2, flower * 0.2);
  });
  addBud(stem(1), (rand() - 0.5) * 0.4);
  return { outline, veins, branch, fill: true, extent: s * 1.1 };
}

/** Tiny bud (far band only), `2s` long: an ellipse or a plain petal without the notch. */
function bud(s: number, rand: () => number, variant: number): Shape {
  const outline = new Path2D();
  const w = 0.5 + 0.1 * rand();
  if (variant % 2) ellipse(outline, 0, 0, s * w, s);
  else petalPath(outline, s * 2, { w: w * 0.9, notch: 0, depth: 0 }, 0, 0, s);
  return { outline, fill: true, extent: s * 1.05 };
}

/**
 * Dendritic flake of radius `s`: six arms with pairs of branches at 60° at 0.35, 0.6 and 0.82 of
 * the arm, 0.35, 0.25 and 0.15 of it long, each length ± `SEASONS.winter.branchJitter` per
 * variant. All six arms alike: the six-fold symmetry holds, the variants differ (lines only).
 */
function dendrite(s: number, rand: () => number): Shape {
  const j = SEASONS.winter.branchJitter;
  const branches = [
    [0.35, 0.35],
    [0.6, 0.25],
    [0.82, 0.15],
  ].map(([at, length]) => [at * s, length * s * (1 + (rand() * 2 - 1) * j)]);
  const outline = new Path2D();
  const spread = Math.PI / 3;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    outline.moveTo(0, 0);
    outline.lineTo(...turn([s, 0], a));
    for (const [at, length] of branches) {
      outline.moveTo(...turn([at + length * Math.cos(spread), length * Math.sin(spread)], a));
      outline.lineTo(...turn([at, 0], a));
      outline.lineTo(...turn([at + length * Math.cos(spread), -length * Math.sin(spread)], a));
    }
  }
  return { outline, fill: false, extent: s };
}

/** Hexagonal plate of radius `s`: outer hexagon, inner one at 0.55, six spokes between them, small notches. */
function plate(s: number, rand: () => number): Shape {
  const corner = (i: number, r: number): Point => turn([r, 0], (i * Math.PI) / 3);
  const outline = new Path2D();
  for (let i = 0; i < 6; i++) outline.lineTo(...corner(i, s));
  outline.closePath();
  const veins = new Path2D();
  const inner = 0.55 * s;
  veins.moveTo(...corner(0, inner));
  for (let i = 1; i <= 6; i++) veins.lineTo(...corner(i, inner));
  // Notches: a short tick in from the middle of each outer side, of one length per variant.
  const notch = s * (0.12 + 0.08 * rand());
  const apothem = s * Math.cos(Math.PI / 6);
  for (let i = 0; i < 6; i++) {
    veins.moveTo(...corner(i, inner));
    veins.lineTo(...corner(i, s));
    const a = ((i + 0.5) * Math.PI) / 3;
    veins.moveTo(...turn([apothem, 0], a));
    veins.lineTo(...turn([apothem - notch, 0], a));
  }
  return { outline, veins, fill: true, extent: s };
}

/** Soft dot: a filled circle with no outline, its radius picked per variant. */
function dot(s: number, rand: () => number): Shape {
  const [lo, hi] = SEASONS.winter.dotRadiusPx;
  // `s` is the largest radius at this window size.
  const r = (s * (lo + (hi - lo) * rand())) / hi;
  return { outline: new Path2D(), fill: false, extent: s, dot: r };
}

/**
 * Fir twig `2s` long, tip up: a curved stem and 7–9 pairs of needles curving down, shorter toward
 * the tip, with a light fill over the polygon through the needle tips so it reads as one mass
 * (docs/tasks/seasons-art-2.md task 3).
 */
function fir(s: number, rand: () => number, _variant: number, depth: number): Shape {
  const bow = (rand() * 2 - 1) * 0.2 * s;
  /** Point of the stem at `t` (0 base, 1 tip). */
  const stem = (t: number): Point => [bow * 4 * t * (1 - t), s - 2 * s * t];
  const outline = new Path2D();
  outline.moveTo(...stem(0));
  outline.quadraticCurveTo(bow * 2, 0, ...stem(1));
  const veins = new Path2D();
  const pairs = 7 + Math.floor(rand() * 3);
  // Needle tips on each side, base to tip.
  const tips: Record<number, Point[]> = { [-1]: [], [1]: [] };
  for (let i = 0; i < pairs; i++) {
    const t = 0.1 + (0.85 * i) / pairs;
    const length = s * (0.5 - 0.32 * (i / (pairs - 1))) * (0.9 + 0.2 * rand());
    const [x, y] = stem(t);
    for (const side of [-1, 1]) {
      // Out and up a little, then drooping down at the end.
      const tip: Point = [x + side * length * 0.9, y + length * 0.15];
      veins.moveTo(x, y);
      veins.quadraticCurveTo(x + side * length * 0.55, y - length * 0.3, ...tip);
      tips[side].push(tip);
    }
  }
  const mass = new Path2D();
  mass.moveTo(...stem(0.05));
  for (const tip of tips[1]) mass.lineTo(...tip);
  mass.lineTo(...stem(1));
  for (const tip of tips[-1].reverse()) mass.lineTo(...tip);
  mass.closePath();
  const { needlePx, stemPx, massAlpha } = SEASONS.winter.fir;
  return { outline, veins, mass, fill: false, fillAlpha: massAlpha, outlinePx: stemPx, veinPx: needlePx[depth], extent: s * 1.05 };
}

/**
 * A bubble of radius `r` at (`x`, `y`) added to the paths: its circle, a long glint arc inside on
 * the upper left and (`dot`) a glint dot on the lower right.
 */
function addBubble(outline: Path2D, veins: Path2D, spots: Path2D, x: number, y: number, r: number, dot = true) {
  ellipse(outline, x, y, r, r);
  const glint = r * 0.7;
  veins.moveTo(x + Math.cos(Math.PI * 1.05) * glint, y + Math.sin(Math.PI * 1.05) * glint);
  veins.arc(x, y, glint, Math.PI * 1.05, Math.PI * 1.5);
  if (dot) ellipse(spots, x + r * 0.45, y + r * 0.45, r * 0.08, r * 0.08);
}

/** Single bubble of radius `s`, radial fill and two glints. */
function bubble(s: number): Shape {
  const outline = new Path2D();
  const veins = new Path2D();
  const spots = new Path2D();
  addBubble(outline, veins, spots, 0, 0, s);
  return { outline, veins, spots, fill: true, bubbles: [[0, 0, s]], extent: s };
}

/**
 * Bubble cluster: 3–5 bubbles of radii `SEASONS.summer.cluster.radii` (× the biggest, `s` /
 * `CLUSTER_SPAN`) in a column, the biggest on top, each ± `offset` × its radius sideways.
 */
function cluster(s: number, rand: () => number): Shape {
  const { radii, offset } = SEASONS.summer.cluster;
  const big = s / CLUSTER_SPAN;
  const count = 3 + Math.floor(rand() * 3);
  const circles: [number, number, number][] = [];
  let y = 0;
  for (const k of radii.slice(0, count)) {
    const r = big * k;
    const prev = circles.at(-1);
    // Just apart from the bubble above.
    if (prev) y += prev[2] + r + big * 0.08;
    circles.push([(rand() * 2 - 1) * offset * r, y, r]);
  }
  // Centred on the column.
  const top = -circles[0][2];
  const bottom = y + circles.at(-1)![2];
  const shift = (top + bottom) / 2;
  const outline = new Path2D();
  const veins = new Path2D();
  const spots = new Path2D();
  const bubbles = circles.map(([x, cy, r]): [number, number, number] => [x, cy - shift, r]);
  // Only the bigger bubbles get the glint dot: on the small ones it would be a speck.
  for (const [x, cy, r] of bubbles) addBubble(outline, veins, spots, x, cy, r, r >= big * 0.5);
  const extent = Math.max((bottom - top) / 2, ...bubbles.map(([x, , r]) => Math.abs(x) + r));
  return { outline, veins, spots, fill: true, bubbles, extent };
}

/**
 * Scallop shell `2s` wide, hinge down: 7–9 ribs fanning out from the hinge, a wavy margin with a
 * crest at the end of each rib, two small ears at the base.
 */
function shell(s: number, rand: () => number): Shape {
  const pen = new LeafPen(rand, 0, 0.03);
  const ribs = 7 + Math.floor(rand() * 3);
  const half = 52 + rand() * 8;
  const r = 1 / Math.sin((half * Math.PI) / 180);
  const ear = 0.24 + 0.05 * rand();
  const sector = (2 * half) / ribs;
  pen.outline.push({ move: [-ear, 0.06] }, { line: [ear, 0.06] }, { line: pen.at([ear * 0.95, -0.06]) }, { line: pen.at(polar(half, 0.32)) });
  pen.outline.push({ line: pen.at(polar(half, r * 0.97)) });
  // The margin, right to left: a crest over every rib.
  for (let i = 0; i < ribs; i++) {
    const mid = half - sector * (i + 0.5);
    pen.outline.push({ quad: [pen.at(polar(mid, r * 1.09)), pen.at(polar(mid - sector / 2, r * 0.97))] });
  }
  pen.outline.push({ line: pen.at(polar(-half, 0.32)) }, { line: pen.at([-ear * 0.95, -0.06]) });
  for (let i = 0; i < ribs; i++) {
    const mid = half - sector * (i + 0.5);
    pen.vein(polar(mid * 0.5, 0.14), polar(mid, r * 0.5), polar(mid, r * 0.95));
  }
  // The hinge line between the ears and the fan.
  pen.veins.push({ move: [-ear * 0.9, -0.03] }, { line: [ear * 0.9, -0.03] });
  return pen.shape(s);
}

/**
 * Starfish of radius `s`: five tapering arms, each a little longer or shorter and bent a little
 * to one side, a row of 6–8 dots down the middle of each, shrinking toward the tip.
 */
function starfish(s: number, rand: () => number): Shape {
  const turn0 = (rand() - 0.5) * 20;
  const arms = Array.from({ length: 5 }, (_, i) => ({
    deg: turn0 + i * 72 + (rand() - 0.5) * 8,
    len: 0.9 + 0.1 * rand(),
    bend: (rand() * 2 - 1) * 9,
  }));
  const valley = 0.36;
  const outline = new Path2D();
  const spots = new Path2D();
  const at = (deg: number, r: number) => polar(deg, r * s);
  arms.forEach(({ deg, len, bend }, i) => {
    const next = arms[(i + 1) % 5];
    const nextDeg = next.deg + (i === 4 ? 360 : 0);
    const before = (deg + arms[(i + 4) % 5].deg - (i === 0 ? 360 : 0)) / 2;
    const after = (deg + nextDeg) / 2;
    if (i === 0) outline.moveTo(...at(before, valley));
    // Up one side of the arm, round its tip, down the other side to the next valley.
    outline.quadraticCurveTo(...at(deg - 13 + bend * 0.5, 0.6 * len), ...at(deg + bend - 5, 0.94 * len));
    outline.quadraticCurveTo(...at(deg + bend, 1.04 * len), ...at(deg + bend + 5, 0.94 * len));
    outline.quadraticCurveTo(...at(deg + 13 + bend * 0.5, 0.6 * len), ...at(after, valley));
    const dots = 6 + Math.floor(rand() * 3);
    for (let k = 0; k < dots; k++) {
      const t = 0.2 + (0.62 * k) / (dots - 1);
      const [x, y] = at(deg + bend * t * t, t * len);
      const r = s * (0.034 - 0.014 * t);
      ellipse(spots, x, y, r, r);
    }
  });
  outline.closePath();
  return { outline, spots, fill: true, extent: s * 1.05 };
}

/** Shape builders; `rand` (seeded per variant) is for the shapes that vary. */
const SHAPES: Record<Kind, (s: number, rand: () => number, variant: number, depth: number) => Shape> = {
  maple,
  oak,
  birch,
  ginkgo,
  petal,
  blossom,
  dendrite,
  plate,
  dot,
  fir,
  bubble,
  cluster,
  shell,
  starfish,
  sprig,
  bud,
};

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
  const shape = SHAPES[kind](kindRadius(kind, depth) * view, rand, variant, depth);
  const half = Math.ceil(shape.extent + MARGIN);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.ceil(half * 2 * dpr);
  const g = canvas.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, canvas.width / 2, canvas.height / 2);
  g.strokeStyle = g.fillStyle = color;
  if (shape.dot) {
    softDot(g, shape.dot);
    return { canvas, half };
  }
  g.lineCap = g.lineJoin = "round";
  if (shape.branch) {
    g.lineWidth = SEASONS.spring.sprig.branchPx;
    g.stroke(shape.branch);
  }
  if (shape.mass) {
    g.globalAlpha = shape.fillAlpha ?? style.fillAlpha;
    g.fill(shape.mass);
  }
  if (shape.bubbles) radialFill(g, shape.bubbles, color);
  else if (shape.fill) {
    g.globalAlpha = shape.fillAlpha ?? style.fillAlpha;
    g.fill(shape.outline);
  }
  g.globalAlpha = 1;
  g.lineWidth = shape.outlinePx ?? band.linePx;
  g.stroke(shape.outline);
  if (shape.veins) {
    g.globalAlpha = style.veinAlpha;
    g.lineWidth = shape.veinPx ?? band.linePx * style.veinWidth;
    g.stroke(shape.veins);
  }
  if (shape.spots) {
    g.globalAlpha = style.veinAlpha;
    g.fill(shape.spots);
  }
  g.globalAlpha = style.pencilAlpha;
  g.lineWidth = shape.outlinePx ?? band.linePx;
  g.translate(Math.cos(pencilAngle) * pencilPx, Math.sin(pencilAngle) * pencilPx);
  g.stroke(shape.outline);
  return { canvas, half };
}

/**
 * Each bubble filled from almost clear at its centre (a little toward the upper left glint) to
 * `SEASONS.summer.bubbleFillAlpha[1]` at its edge.
 */
function radialFill(g: CanvasRenderingContext2D, bubbles: [number, number, number][], color: string) {
  const [inner, edge] = SEASONS.summer.bubbleFillAlpha;
  g.globalAlpha = 1;
  for (const [x, y, r] of bubbles) {
    const fill = g.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r);
    fill.addColorStop(0, withAlpha(g, color, inner));
    fill.addColorStop(0.65, withAlpha(g, color, (inner + edge) / 2));
    fill.addColorStop(1, withAlpha(g, color, edge));
    g.fillStyle = fill;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = color;
}

/** `color` (any CSS colour the canvas accepts) at opacity `a`, for gradient stops. */
function withAlpha(g: CanvasRenderingContext2D, color: string, a: number) {
  g.fillStyle = color;
  // The canvas reads it back as `#rrggbb` (opaque) or `rgba(r, g, b, a)`.
  const read = String(g.fillStyle);
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(read);
  if (hex) return `rgb(${hex.slice(1).map((h) => Number.parseInt(h, 16)).join(" ")} / ${a})`;
  const rgba = /^rgba?\(([^,]+),([^,]+),([^,)]+)(?:,\s*([\d.]+))?\)$/.exec(read);
  if (rgba) return `rgb(${rgba[1]} ${rgba[2]} ${rgba[3]} / ${a * Number(rgba[4] ?? 1)})`;
  return color;
}

/** A filled dot of radius `r` that fades out toward its edge (the fill colour is already set). */
function softDot(g: CanvasRenderingContext2D, r: number) {
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  // Only the mask's alpha counts with destination-in: the colour stays the fill's.
  const mask = g.createRadialGradient(0, 0, 0, 0, 0, r);
  mask.addColorStop(0.4, "#000");
  mask.addColorStop(1, "rgb(0 0 0 / 0)");
  g.globalCompositeOperation = "destination-in";
  g.fillStyle = mask;
  g.fillRect(-r, -r, r * 2, r * 2);
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
