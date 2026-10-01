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

/**
 * Right half of a maple leaf (x ≥ 0), from the top tip to the stem, for a leaf of half
 * height 1 pointing up: three lobes with a few teeth. The left half is its mirror image.
 */
const MAPLE: readonly Point[] = [
  [0, -1],
  [0.1, -0.74],
  [0.22, -0.8],
  [0.17, -0.56],
  [0.14, -0.36],
  [0.5, -0.6],
  [0.52, -0.5],
  [0.9, -0.52],
  [0.74, -0.32],
  [0.86, -0.22],
  [0.6, -0.1],
  [0.4, -0.02],
  [0.62, 0.26],
  [0.36, 0.2],
  [0.24, 0.3],
  [0.05, 0.42],
];
/** Where the veins of the maple leaf end: top, side and lower lobes (right half). */
const MAPLE_VEINS: readonly Point[] = [
  [0, -0.82],
  [0.74, -0.44],
  [0.48, 0.18],
];

function leaf(s: number): Shape {
  const outline = new Path2D();
  outline.moveTo(0, -s);
  for (const [x, y] of MAPLE) outline.lineTo(x * s, y * s);
  for (let i = MAPLE.length - 1; i >= 0; i--) outline.lineTo(-MAPLE[i][0] * s, MAPLE[i][1] * s);
  outline.closePath();
  // Stem and veins, from the base of the blade.
  const veins = new Path2D();
  veins.moveTo(0, 0.85 * s);
  veins.lineTo(0, 0.3 * s);
  for (const [x, y] of MAPLE_VEINS) {
    for (const side of x ? [1, -1] : [1]) {
      veins.moveTo(0, 0.3 * s);
      veins.lineTo(side * x * s, y * s);
    }
  }
  return { outline, veins, fill: true, extent: s };
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
const SHAPES: Record<Kind, (s: number, rand: () => number) => Shape> = { leaf, petal, blossom, flake, bubble };

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
