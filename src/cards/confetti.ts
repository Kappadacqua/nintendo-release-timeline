import { gsap } from "gsap";

const COLORS = ["var(--red)", "var(--red-soft)", "#ff8a95", "#b3000e", "#fff"];
const PIECES = 28;

/**
 * One burst of red confetti from the top of a card ("out today", ITERATION-2 §5).
 * The pieces live next to the card, in the same positioned parent, so they
 * scroll with it; the container removes itself when done.
 */
export function confettiBurst(card: HTMLElement) {
  const parent = card.parentElement;
  if (!parent) return;
  const burst = document.createElement("div");
  burst.className = "confetti";
  burst.setAttribute("aria-hidden", "true");
  burst.style.left = `${card.offsetLeft + card.offsetWidth / 2}px`;
  burst.style.top = `${card.offsetTop + 24}px`;
  parent.append(burst);

  const tl = gsap.timeline({ onComplete: () => burst.remove() });
  for (let i = 0; i < PIECES; i++) {
    const piece = document.createElement("i");
    piece.style.background = COLORS[i % COLORS.length];
    if (i % 3 === 0) piece.style.borderRadius = "50%";
    burst.append(piece);
    // Mostly upward fan, then falling with a bit of drift.
    const angle = (-90 + gsap.utils.random(-70, 70)) * (Math.PI / 180);
    const speed = gsap.utils.random(90, 190);
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;
    const life = gsap.utils.random(0.9, 1.4);
    tl.fromTo(
      piece,
      { x: 0, y: 0, rotation: gsap.utils.random(0, 360), opacity: 1, scale: gsap.utils.random(0.7, 1.2) },
      { x: dx, rotation: `+=${gsap.utils.random(180, 540)}`, duration: life, ease: "power2.out" },
      0,
    )
      .to(piece, { y: dy, duration: life * 0.45, ease: "power2.out" }, 0)
      .to(piece, { y: dy + gsap.utils.random(60, 120), duration: life * 0.55, ease: "power1.in" }, life * 0.45)
      .to(piece, { opacity: 0, duration: 0.3 }, life - 0.3);
  }
}
