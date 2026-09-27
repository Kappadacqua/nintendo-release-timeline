import { NEWS_LABEL, news } from "./news";
import { MONTHS } from "./timeline/dates";
import type { Change, Game } from "./types";

const DAY_MS = 86_400_000;

function fmt(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
}

/** Monday of the week of `date` (YYYY-MM-DD, UTC). */
function weekOf(date: string) {
  const t = Date.parse(date);
  return new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
}

function weekLabel(monday: string, today: string) {
  const weeks = Math.round((Date.parse(weekOf(today)) - Date.parse(monday)) / (7 * DAY_MS));
  if (weeks === 0) return "This week";
  if (weeks === 1) return "Last week";
  const [, m, d] = monday.split("-").map(Number);
  return `Week of ${MONTHS[m - 1].slice(0, 3)} ${d}`;
}

function detail(c: Change, game: Game) {
  const when = (d: string | null) => (d ? fmt(d) : (game.vagueRelease?.label ?? "TBA"));
  if (c.type === "new" && game.kind === "free-update") return `Free update · ${when(game.firstReleaseDate)}`;
  if (c.type === "new") return `Added · ${game.firstReleaseDate ? `out ${fmt(game.firstReleaseDate)}` : when(null)}`;
  if (c.type === "delayed") return `${fmt(c.from)} → ${when(c.to)}`;
  return `First reviews · ${c.source === "opencritic" ? "OpenCritic" : "Metacritic"} ${c.normalized}`;
}

/**
 * "What's new" in the header (ITERATION-3 §4): the unseen count on the button, a
 * panel with the changes grouped by week; a click jumps to the game and selects it.
 * Also keeps the cards' "!" badges and the minimap dots in step with what is seen.
 */
export class WhatsNew {
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly byId: Map<string, Game>;

  constructor(
    host: HTMLElement,
    games: Game[],
    private readonly today: string,
    private readonly isVisible: (game: Game) => boolean,
    private readonly onPick: (game: Game) => void,
  ) {
    this.byId = new Map(games.map((g) => [g.id, g]));
    const wrap = document.createElement("div");
    wrap.className = "whats-new";
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "whats-new__toggle";
    this.button.setAttribute("aria-expanded", "false");
    this.button.setAttribute("aria-controls", "whats-new-panel");
    this.button.title = "What's new";
    this.button.innerHTML = `<span class="whats-new__icon" aria-hidden="true">!</span><span class="whats-new__label">What's new</span><span class="whats-new__count"></span>`;

    this.panel = document.createElement("div");
    this.panel.className = "whats-new__panel";
    this.panel.id = "whats-new-panel";
    this.panel.hidden = true;
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-label", "What's new");
    wrap.append(this.button, this.panel);
    host.prepend(wrap);

    this.button.addEventListener("click", () => this.setOpen(this.panel.hidden));
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target as Node)) this.setOpen(false);
    });
    wrap.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.panel.hidden) {
        e.stopPropagation();
        this.setOpen(false);
        this.button.focus();
      }
    });
    news.onChange(() => this.sync());
    this.sync();
  }

  private setOpen(open: boolean) {
    if (open) this.render();
    this.panel.hidden = !open;
    this.button.setAttribute("aria-expanded", String(open));
  }

  /** Button count, card badges and minimap dots after something was seen. */
  private sync() {
    const unseen = news.unseen().filter((c) => this.byId.has(c.id));
    const count = this.button.querySelector<HTMLElement>(".whats-new__count")!;
    count.textContent = String(unseen.length);
    count.hidden = !unseen.length;
    this.button.classList.toggle("has-news", unseen.length > 0);
    this.button.setAttribute("aria-label", unseen.length ? `What's new: ${unseen.length} not seen yet` : "What's new");
    const fresh = new Set(unseen.map((c) => c.id));
    for (const badge of document.querySelectorAll<HTMLElement>(".badge--news")) {
      const id = badge.closest<HTMLElement>(".card")?.dataset.gameId;
      if (!id || fresh.has(id)) continue;
      // A fresh delay stays a (plain) Delayed badge.
      if (badge.dataset.seenAs) {
        badge.className = `badge ${badge.dataset.seenAs}`;
        badge.querySelector(".badge__bang")?.remove();
        badge.removeAttribute("title");
      } else {
        badge.remove();
      }
    }
    // A same-day group's dot stands for several games.
    for (const dot of document.querySelectorAll<HTMLElement>(".minimap__dot[data-game-ids]")) {
      dot.classList.toggle("has-news", dot.dataset.gameIds!.split(" ").some((id) => fresh.has(id)));
    }
    if (!this.panel.hidden) this.render();
  }

  private render() {
    const changes = news.changes.filter((c) => this.byId.has(c.id));
    const head = document.createElement("div");
    head.className = "whats-new__head";
    head.innerHTML = `<h2>What's new</h2><button type="button" class="whats-new__all">Mark all as seen</button>`;
    const all = head.querySelector("button")!;
    all.disabled = !news.unseen().length;
    all.addEventListener("click", () => news.markAllSeen());

    const body = document.createElement("div");
    body.className = "whats-new__body";
    if (!changes.length) {
      const empty = document.createElement("p");
      empty.className = "whats-new__empty";
      empty.textContent = "Nothing new yet. New games, delays and first reviews show up here after each data update.";
      body.append(empty);
    }
    let week = "";
    let list: HTMLUListElement | null = null;
    for (const c of changes) {
      const game = this.byId.get(c.id)!;
      if (weekOf(c.date) !== week) {
        week = weekOf(c.date);
        const h = document.createElement("h3");
        h.textContent = weekLabel(week, this.today);
        list = document.createElement("ul");
        body.append(h, list);
      }
      const li = document.createElement("li");
      const item = document.createElement("button");
      item.type = "button";
      item.className = `whats-new__item whats-new__item--${c.type}${news.isSeen(c) ? " is-seen" : ""}`;
      item.innerHTML = `<img alt="" loading="lazy"><span class="whats-new__text"><span class="whats-new__type"></span><strong></strong><small></small></span><time></time>`;
      item.querySelector("img")!.src = game.coverUrl;
      item.querySelector(".whats-new__type")!.textContent = NEWS_LABEL[c.type];
      item.querySelector("strong")!.textContent = game.title;
      item.querySelector("time")!.textContent = fmt(c.date).replace(/, \d{4}$/, "");
      item.querySelector("time")!.dateTime = c.date;
      const small = item.querySelector("small")!;
      if (this.isVisible(game)) {
        small.textContent = detail(c, game);
        item.addEventListener("click", () => {
          this.setOpen(false);
          this.onPick(game);
        });
      } else {
        small.textContent = "Hidden by the current filters";
        item.disabled = true;
      }
      li.append(item);
      list!.append(li);
    }
    this.panel.replaceChildren(head, body);
  }
}
