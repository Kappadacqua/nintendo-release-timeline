import { gsap } from "gsap";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

export function currentTheme(): Theme {
  return storedTheme() ?? (systemDark.matches ? "dark" : "light");
}

function apply(theme: Theme, button: HTMLButtonElement) {
  document.documentElement.dataset.theme = theme;
  const next = theme === "dark" ? "light" : "dark";
  button.setAttribute("aria-label", `Switch to ${next} theme`);
  button.title = `Switch to ${next} theme`;
}

/** Follows the system preference until the user picks a theme manually. */
export function initTheme(button: HTMLButtonElement) {
  apply(currentTheme(), button);

  systemDark.addEventListener("change", () => {
    if (!storedTheme()) apply(currentTheme(), button);
  });

  button.addEventListener("click", () => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable: theme still switches for this session.
    }
    apply(next, button);
    gsap.fromTo(
      button.querySelector(".theme-toggle__icon"),
      { rotate: -90, scale: 0.6 },
      { rotate: 0, scale: 1, duration: 0.45, ease: "back.out(2)" },
    );
  });
}
