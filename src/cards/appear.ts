import { gsap } from "gsap";
import type { Card } from "./card";
import { confettiBurst } from "./confetti";
import type { Side } from "./layout";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/** Hidden state before a card's release date first scrolls into view. */
export function hideCard(connector: SVGSVGElement[] | null, card: Card) {
  gsap.set(card.el, { opacity: 0 });
  if (connector) gsap.set(connector, { scaleY: 0, transformOrigin: "0 0" });
}

/**
 * One-shot entrance: connector grows, card rises from the line, then rings fill.
 * `instant`: cards already on screen when the page opens are simply there.
 */
export function revealCard(connector: SVGSVGElement[] | null, card: Card, side: Side, instant = false) {
  if (reducedMotion.matches || instant) {
    if (connector) gsap.set(connector, { scaleY: 1 });
    gsap.set(card.el, { opacity: 1 });
    card.rings.forEach((r) => r.finish());
    if (instant && !reducedMotion.matches && card.el.classList.contains("card--out-today")) confettiBurst(card.el);
    return;
  }

  const towardLine = side === "above" ? 1 : -1;
  const tl = gsap.timeline();
  if (connector) tl.to(connector, { scaleY: 1, duration: 0.25, ease: "power2.out" });
  tl.fromTo(
    card.el,
    { opacity: 0, scale: 0.7, y: 48 * towardLine },
    {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.55,
      ease: "back.out(1.4)",
      transformOrigin: side === "above" ? "50% 100%" : "50% 0%",
    },
    0.1,
  );
  card.rings.forEach((ring, i) => tl.add(ring.fill(), 0.45 + i * 0.08));
  // Released today somewhere: a one-off burst once the card has landed (the glow is CSS).
  if (card.el.classList.contains("card--out-today")) tl.call(() => confettiBurst(card.el), undefined, 0.5);
}
