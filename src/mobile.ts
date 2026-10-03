import { COMPACT_HEADER_QUERY, isTouchPrimary } from "./layout";

/**
 * Phones and narrow windows (SPEC "Mobile"): the header's actions (pages, What's new, View,
 * filters, help, theme) live in a drawer opened by the menu button; a bar at the bottom of the
 * timeline gives the touch equivalents of Page Up, T and Page Down, next to the zoom levels.
 * Above the breakpoint the same markup is the desktop header row (CSS only), and this does nothing.
 */
export class MobileMenu {
  private readonly toggle: HTMLButtonElement;
  private readonly drawer: HTMLElement;
  private readonly scrim: HTMLElement;
  private readonly badge: HTMLElement;
  private readonly compact = matchMedia(COMPACT_HEADER_QUERY);

  constructor(onGo: (where: "start" | "today" | "tba") => void) {
    this.toggle = document.querySelector<HTMLButtonElement>(".menu-toggle")!;
    this.drawer = document.querySelector<HTMLElement>("#app-menu")!;
    this.scrim = document.querySelector<HTMLElement>(".app-menu-scrim")!;
    this.badge = this.toggle.querySelector<HTMLElement>(".menu-toggle__badge")!;
    this.drawer.setAttribute("aria-label", "Menu");

    this.toggle.addEventListener("click", () => this.setOpen(!this.isOpen));
    this.drawer.querySelector(".app-menu__close")!.addEventListener("click", () => this.setOpen(false, true));
    this.scrim.addEventListener("click", () => this.setOpen(false, true));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen && !(e.target as HTMLElement).closest?.("dialog")) {
        // A panel open inside the drawer closes first (its own handler stops the event).
        this.setOpen(false, true);
      }
    });
    for (const button of this.drawer.querySelectorAll<HTMLButtonElement>("[data-go]")) {
      button.addEventListener("click", () => {
        this.setOpen(false);
        onGo(button.dataset.go as "start" | "today" | "tba");
      });
    }
    // Picking something that acts on the timeline closes the drawer, so the result is seen:
    // a What's new entry, the presentation, help, the search.
    this.drawer.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest(".whats-new__item:not(:disabled), .view-menu__action, .shortcuts-toggle")) this.setOpen(false);
    });
    // Back above the breakpoint: the drawer is the header row again.
    this.compact.addEventListener("change", () => {
      if (!this.compact.matches) this.setOpen(false);
    });

    // Touch first: the help dialog talks about gestures before keys.
    if (isTouchPrimary()) {
      document.querySelector("#shortcuts-title")!.textContent = "Gestures and shortcuts";
      document.querySelector(".shortcuts-toggle")?.setAttribute("aria-label", "Gestures, shortcuts and legend");
    }
  }

  get isOpen() {
    return document.body.classList.contains("menu-open");
  }

  setOpen(open: boolean, restoreFocus = false) {
    if (open === this.isOpen) return;
    document.body.classList.toggle("menu-open", open);
    this.toggle.setAttribute("aria-expanded", String(open));
    this.scrim.hidden = !open;
    if (open) {
      this.drawer.querySelector<HTMLElement>(".app-menu__close")?.focus({ preventScroll: true });
      this.drawer.scrollTop = 0;
    } else if (restoreFocus) {
      this.toggle.focus({ preventScroll: true });
    }
  }

  /** Unseen What's new count on the menu button (the drawer holds the real button). */
  setBadge(count: number) {
    this.badge.hidden = count <= 0;
    this.badge.textContent = count > 99 ? "99+" : String(count);
    this.toggle.setAttribute("aria-label", count > 0 ? `Menu, ${count} new` : "Menu");
  }
}

/** Bottom bar: previous game, today, next game; the zoom control sits at its right (CSS). */
export class Dock {
  readonly el: HTMLElement;

  constructor(host: HTMLElement, actions: { onStep: (direction: 1 | -1) => void; onToday: () => void }) {
    this.el = document.createElement("div");
    this.el.className = "timeline-dock";
    this.el.setAttribute("role", "toolbar");
    this.el.setAttribute("aria-label", "Timeline");
    const button = (className: string, label: string, html: string, run: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `timeline-dock__button ${className}`;
      b.setAttribute("aria-label", label);
      b.title = label;
      b.innerHTML = html;
      b.addEventListener("click", run);
      return b;
    };
    this.el.append(
      button("timeline-dock__prev", "Previous game", `<span aria-hidden="true">‹</span>`, () => actions.onStep(-1)),
      button("timeline-dock__today", "Today", `Today`, actions.onToday),
      button("timeline-dock__next", "Next game", `<span aria-hidden="true">›</span>`, () => actions.onStep(1)),
    );
    host.append(this.el);
  }
}
