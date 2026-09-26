import { gsap } from "gsap";
import type { Score } from "../types";

const RADIUS = 19;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type Tier = "mighty" | "strong" | "fair" | "weak" | "none";

/** OpenCritic tiers, applied to the normalized 0–100 value. */
export function tier(score: Score | null): Tier {
  if (!score) return "none";
  if (score.normalized >= 84) return "mighty";
  if (score.normalized >= 75) return "strong";
  if (score.normalized >= 65) return "fair";
  return "weak";
}

function compactCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}

function formatValue(value: number, scale: Score["scale"]) {
  return scale === 100 ? String(Math.round(value)) : value.toFixed(1);
}

export interface ScoreRing {
  el: HTMLElement;
  /** Fills the ring and counts the number up; add to a GSAP timeline. */
  fill(): gsap.core.Timeline;
  /** Jump to the final state without animation. */
  finish(): void;
}

export function createScoreRing(
  score: Score | null,
  source: string,
  href: string | undefined,
  unit: "reviews" | "ratings",
): ScoreRing {
  const el = document.createElement("div");
  el.className = `ring ring--${tier(score)}`;
  el.innerHTML = `
    <div class="ring__dial">
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle class="ring__track" cx="22" cy="22" r="${RADIUS}" />
        <circle class="ring__fill" cx="22" cy="22" r="${RADIUS}" transform="rotate(-90 22 22)"
          stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="${CIRCUMFERENCE}" />
      </svg>
      <span class="ring__value"></span>
    </div>`;

  const valueEl = el.querySelector<HTMLElement>(".ring__value")!;
  const fillEl = el.querySelector<SVGCircleElement>(".ring__fill")!;

  const sourceEl = document.createElement(href ? "a" : "span");
  sourceEl.className = "ring__source";
  sourceEl.textContent = source;
  if (href && sourceEl instanceof HTMLAnchorElement) {
    sourceEl.href = href;
    sourceEl.target = "_blank";
    sourceEl.rel = "noopener noreferrer";
  }
  const countEl = document.createElement("span");
  countEl.className = "ring__count";
  countEl.textContent = score?.count != null ? `${compactCount(score.count)} ${unit}` : "—";
  el.append(sourceEl, countEl);

  if (!score) {
    valueEl.textContent = "N/D";
    el.setAttribute("aria-label", `${source}: no score`);
    return { el, fill: () => gsap.timeline(), finish: () => {} };
  }

  el.setAttribute("aria-label", `${source}: ${formatValue(score.value, score.scale)} out of ${score.scale}`);
  const targetOffset = CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, score.normalized)) / 100);
  valueEl.textContent = formatValue(0, score.scale);

  return {
    el,
    fill() {
      const counter = { v: 0 };
      return gsap
        .timeline()
        .to(fillEl, { attr: { "stroke-dashoffset": targetOffset }, duration: 0.9, ease: "power2.out" }, 0)
        .to(
          counter,
          {
            v: score.value,
            duration: 0.9,
            ease: "power2.out",
            onUpdate: () => {
              valueEl.textContent = formatValue(counter.v, score.scale);
            },
          },
          0,
        );
    },
    finish() {
      fillEl.setAttribute("stroke-dashoffset", String(targetOffset));
      valueEl.textContent = formatValue(score.value, score.scale);
    },
  };
}
