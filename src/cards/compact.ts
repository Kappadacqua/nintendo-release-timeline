import { gsap } from "gsap";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
/** Parts a compact card hides (see FULL_ONLY in card.ts). */
const PART = ".card__full";
const DURATION = 0.35;

const shown = (el: HTMLElement) => getComputedStyle(el).display !== "none";

/**
 * Runs `change` (which switches a card between full and compact, e.g. by toggling a class)
 * and animates the parts it shows or hides: they unfold / fold instead of popping.
 * A folding part keeps `is-folding`, which the CSS leaves displayed until the end.
 */
export function morphParts(cards: HTMLElement[], change: () => void, animate = true) {
  const parts = cards.flatMap((card) => [...card.querySelectorAll<HTMLElement>(PART)]);
  // A fold still running (quick toggles) is finished first, so it is measured as it will be.
  for (const part of parts) {
    if (!gsap.isTweening(part)) continue;
    gsap.killTweensOf(part);
    part.classList.remove("is-folding");
    gsap.set(part, { clearProps: "all" });
  }
  const before = parts.map((part) => (shown(part) ? part.offsetHeight : -1));
  change();
  if (!animate || reducedMotion.matches) return;
  parts.forEach((part, i) => {
    const was = before[i] >= 0;
    const is = shown(part);
    if (was === is) return;
    const collapsed = { height: 0, opacity: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 };
    gsap.killTweensOf(part);
    if (is) {
      gsap.from(part, { ...collapsed, overflow: "hidden", duration: DURATION, ease: "power2.out", clearProps: "all" });
    } else {
      part.classList.add("is-folding");
      gsap.fromTo(
        part,
        { height: before[i], overflow: "hidden" },
        {
          ...collapsed,
          duration: DURATION * 0.8,
          ease: "power2.in",
          onComplete: () => {
            part.classList.remove("is-folding");
            gsap.set(part, { clearProps: "all" });
          },
        },
      );
    }
  });
}

export const MORPH_SECONDS = DURATION;
