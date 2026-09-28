/**
 * Local admin panel (ITERATION-3 §2), development only: fills data/overrides.json
 * through the Vite plugin in scripts/vite-admin.ts, which also rebuilds games.json.
 */
import "../styles/main.css";
import "./admin.css";
import type { Game, GamesFile } from "../types";

if (!import.meta.env.DEV) throw new Error("The admin panel is available only in development.");

type Override = Record<string, unknown> & {
  metacritic?: { critic?: number; criticCount?: number; user?: number; userCount?: number };
  backloggd?: { rating?: number; count?: number };
  links?: Record<string, string>;
  exclusivity?: Game["exclusivity"];
  alsoOnSwitch1?: boolean;
  developer?: string;
};
interface Report {
  exclusivityConflicts?: { id: string; issue: string }[];
}

/** What can be missing, and how to tell. Scores only matter once a game is out; free updates never have any. */
const today = new Date().toISOString().slice(0, 10);
const released = (g: Game) => !!g.firstReleaseDate && g.firstReleaseDate <= today;
const scored = (g: Game) => released(g) && g.kind !== "free-update";
const GAPS: { key: string; label: string; missing: (g: Game, conflicts: Set<string>) => boolean }[] = [
  { key: "opencritic", label: "OpenCritic", missing: (g) => scored(g) && !g.scores.critic.opencritic },
  { key: "metacritic", label: "Metacritic", missing: (g) => scored(g) && (!g.scores.critic.metacritic || !g.scores.user.metacritic) },
  { key: "backloggd", label: "Backloggd", missing: (g) => scored(g) && !g.scores.user.backloggd },
  { key: "wikipedia", label: "Wikipedia", missing: (g) => !g.links.wikipedia },
  { key: "nintendoWiki", label: "Nintendo Wiki", missing: (g) => !g.links.nintendoWiki },
  { key: "nintendoStore", label: "Nintendo Store", missing: (g) => !g.links.nintendoStore },
  { key: "conflict", label: "Exclusivity conflict", missing: (g, c) => c.has(g.id) },
];

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const state = {
  games: [] as Game[],
  overrides: { games: {} } as { games: Record<string, Override> },
  conflicts: new Map<string, string>(),
  filters: new Set<string>(["metacritic", "backloggd"]),
  query: "",
  selectedId: null as string | null,
};

async function load() {
  const [games, overrides, report] = await Promise.all([
    fetch(`/data/games.json?t=${Date.now()}`).then((r) => r.json() as Promise<GamesFile>),
    fetch("/__admin/overrides").then((r) => r.json()),
    fetch("/__admin/report").then((r) => r.json() as Promise<Report | null>),
  ]);
  state.games = games.games;
  state.overrides = overrides;
  state.conflicts = new Map((report?.exclusivityConflicts ?? []).map((c) => [c.id, c.issue]));
  $("#meta").textContent = `${state.games.length} games · games.json built ${games.generatedAt.slice(0, 16).replace("T", " ")}`;
  renderList();
  if (state.selectedId) renderEditor(state.selectedId);
}

function gapsOf(g: Game) {
  const conflicts = new Set(state.conflicts.keys());
  return GAPS.filter((gap) => gap.missing(g, conflicts));
}

function renderFilters() {
  const wrap = $("#filters");
  wrap.replaceChildren(
    ...GAPS.map((gap) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "admin-chip";
      b.textContent = gap.label;
      b.setAttribute("aria-pressed", String(state.filters.has(gap.key)));
      b.addEventListener("click", () => {
        if (state.filters.has(gap.key)) state.filters.delete(gap.key);
        else state.filters.add(gap.key);
        renderFilters();
        renderList();
      });
      return b;
    }),
  );
}

function renderList() {
  const q = state.query.trim().toLowerCase();
  const rows = state.games.filter((g) => {
    if (q && !g.title.toLowerCase().includes(q)) return false;
    if (!state.filters.size) return true;
    return gapsOf(g).some((gap) => state.filters.has(gap.key));
  });
  $("#count").textContent = state.filters.size
    ? `${rows.length} game(s) missing ${[...state.filters].map((k) => GAPS.find((g) => g.key === k)!.label).join(" or ")}`
    : `${rows.length} game(s)`;
  $("#games").replaceChildren(
    ...rows.map((g) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "admin-game";
      if (g.id === state.selectedId) b.setAttribute("aria-current", "true");
      b.innerHTML = `<img alt="" loading="lazy"><span class="admin-game__text"><strong></strong><small></small></span><span class="admin-game__gaps"></span>`;
      b.querySelector("img")!.src = g.coverUrl;
      b.querySelector("strong")!.textContent = g.title;
      b.querySelector("small")!.textContent = `${g.firstReleaseDate ?? g.vagueRelease?.label ?? "TBA"} · ${g.kind}${state.overrides.games[g.id] ? " · overridden" : ""}`;
      b.querySelector(".admin-game__gaps")!.append(
        ...gapsOf(g).map((gap) => {
          const s = document.createElement("span");
          s.className = "admin-gap";
          s.textContent = gap.label;
          return s;
        }),
      );
      b.addEventListener("click", () => {
        state.selectedId = g.id;
        renderList();
        renderEditor(g.id);
      });
      li.append(b);
      return li;
    }),
  );
}

// ---------- Editor ----------

const searchUrl = {
  metacritic: (t: string) => `https://www.metacritic.com/search/${encodeURIComponent(t)}/`,
  backloggd: (t: string) => `https://backloggd.com/search/games/${encodeURIComponent(t)}/`,
  // OpenCritic's own search needs JavaScript and has no query URL.
  opencritic: (t: string) => `https://duckduckgo.com/?q=${encodeURIComponent(`site:opencritic.com/game ${t}`)}`,
};

/** "82 · 46 top critics · id 18663", or why there is no score. */
function openCriticNow(g: Game) {
  const s = g.scores.critic.opencritic;
  const id = /\/game\/(\d+)/.exec(g.links.opencritic ?? "")?.[1];
  if (!s) return id ? `No score yet (id ${id})` : released(g) ? "No OpenCritic page matched" : "Not released yet";
  return `${s.value}${s.count !== null ? ` · ${s.count} top critics` : ""}${id ? ` · id ${id}` : ""}`;
}

function field(label: string, name: string, value: unknown, attrs: Record<string, string>, placeholder = "") {
  const id = `f-${name.replace(/\./g, "-")}`;
  const v = value === undefined || value === null ? "" : String(value);
  const extra = Object.entries(attrs)
    .map(([k, a]) => `${k}="${a}"`)
    .join(" ");
  return `<label for="${id}"><span>${label}</span><input id="${id}" name="${name}" value="${escapeHtml(v)}" placeholder="${escapeHtml(placeholder)}" ${extra}></label>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function renderEditor(id: string) {
  const g = state.games.find((x) => x.id === id);
  const editor = $("#editor");
  if (!g) {
    editor.innerHTML = `<p class="admin-empty">This game is no longer in games.json.</p>`;
    return;
  }
  const o: Override = state.overrides.games[id] ?? {};
  const mc = o.metacritic ?? {};
  const bl = o.backloggd ?? {};
  const links = o.links ?? {};
  const conflict = state.conflicts.get(id);
  const auto = (v: unknown) => (v === null ? "not exclusive" : String(v));
  const sel = (name: string, options: [string, string][], current: string) =>
    `<select name="${name}" id="f-${name}">${options.map(([v, l]) => `<option value="${v}"${v === current ? " selected" : ""}>${l}</option>`).join("")}</select>`;

  editor.innerHTML = `
    <form class="admin-form" novalidate>
      <header class="admin-form__head">
        <img alt="" src="${escapeHtml(g.coverUrl)}">
        <div>
          <h2>${escapeHtml(g.title)}</h2>
          <p>${escapeHtml(id)} · ${escapeHtml(g.kind)} · ${escapeHtml(g.firstReleaseDate ?? g.vagueRelease?.label ?? "TBA")}${released(g) ? "" : " · not released yet"}</p>
          ${conflict ? `<p class="admin-warning">Exclusivity conflict: ${escapeHtml(conflict)}</p>` : ""}
        </div>
      </header>

      <fieldset>
        <legend>OpenCritic <a href="${searchUrl.opencritic(g.title)}" target="_blank" rel="noopener">Find on OpenCritic ↗</a>${g.links.opencritic ? ` <a href="${escapeHtml(g.links.opencritic)}" target="_blank" rel="noopener">Open page ↗</a>` : ""}</legend>
        <div class="admin-grid">
          <label><span>Current score (automatic)</span><output class="admin-readonly">${escapeHtml(openCriticNow(g))}</output></label>
          ${field("Force OpenCritic id", "opencriticId", o.opencriticId, { type: "number", min: "1", step: "1" }, "the number in opencritic.com/game/<id>/…")}
        </div>
      </fieldset>

      <fieldset>
        <legend>Metacritic <a href="${searchUrl.metacritic(g.title)}" target="_blank" rel="noopener">Search on Metacritic ↗</a>${g.links.metacritic ? ` <a href="${escapeHtml(g.links.metacritic)}" target="_blank" rel="noopener">Open page ↗</a>` : ""}</legend>
        <div class="admin-grid">
          ${field("Metascore (0–100)", "metacritic.critic", mc.critic, { type: "number", min: "0", max: "100", step: "1" })}
          ${field("Critic reviews", "metacritic.criticCount", mc.criticCount, { type: "number", min: "0", step: "1" })}
          ${field("User score (0–10)", "metacritic.user", mc.user, { type: "number", min: "0", max: "10", step: "0.1" })}
          ${field("User ratings", "metacritic.userCount", mc.userCount, { type: "number", min: "0", step: "1" })}
        </div>
        ${field("Metacritic page URL", "links.metacritic", links.metacritic, { type: "url" }, "https://www.metacritic.com/game/…/")}
      </fieldset>

      <fieldset>
        <legend>Backloggd <a href="${searchUrl.backloggd(g.title)}" target="_blank" rel="noopener">Search on Backloggd ↗</a>${g.links.backloggd ? ` <a href="${escapeHtml(g.links.backloggd)}" target="_blank" rel="noopener">Open page ↗</a>` : ""}</legend>
        <div class="admin-grid">
          ${field("Rating (0–5)", "backloggd.rating", bl.rating, { type: "number", min: "0", max: "5", step: "0.1" })}
          ${field("Ratings", "backloggd.count", bl.count, { type: "number", min: "0", step: "1" })}
        </div>
      </fieldset>

      <fieldset>
        <legend>Platforms</legend>
        <div class="admin-grid">
          <label><span>Exclusivity</span>${sel(
            "exclusivity",
            [
              ["", `Automatic (${auto(o.exclusivity !== undefined ? "overridden" : g.exclusivity)})`],
              ["exclusive", "Exclusive"],
              ["timed", "Timed exclusive"],
              ["null", "Not exclusive"],
            ],
            o.exclusivity === undefined ? "" : o.exclusivity === null ? "null" : o.exclusivity,
          )}</label>
          <label><span>Also on Switch 1</span>${sel(
            "alsoOnSwitch1",
            [
              ["", `Automatic (${o.alsoOnSwitch1 !== undefined ? "overridden" : g.alsoOnSwitch1 ? "yes" : "no"})`],
              ["true", "Yes"],
              ["false", "No"],
            ],
            o.alsoOnSwitch1 === undefined ? "" : String(o.alsoOnSwitch1),
          )}</label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Developer <small>(leave empty to keep the automatic one; it picks the studio on the Studios page)</small></legend>
        ${field("Developer", "developer", o.developer, { type: "text" }, g.developer ?? "none found")}
      </fieldset>

      <fieldset>
        <legend>Links <small>(leave empty to keep the automatic one)</small></legend>
        ${field("Wikipedia", "links.wikipedia", links.wikipedia, { type: "url" }, g.links.wikipedia ?? "none found")}
        ${field("Nintendo Wiki", "links.nintendoWiki", links.nintendoWiki, { type: "url" }, g.links.nintendoWiki ?? "none found")}
        ${field("Nintendo Store", "links.nintendoStore", links.nintendoStore, { type: "url" }, g.links.nintendoStore ?? "none found")}
      </fieldset>

      <div class="admin-actions">
        <button type="submit" class="admin-save">Save</button>
        ${state.overrides.games[id] ? `<button type="button" class="admin-remove">Remove override</button>` : ""}
        <span class="admin-status" role="status"></span>
      </div>
    </form>`;

  const form = editor.querySelector("form")!;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void save(id, fromForm(form, o, g.title));
  });
  form.querySelector(".admin-remove")?.addEventListener("click", () => void save(id, null));
}

/** Form → override: only non-empty fields; fields the form doesn't manage are kept as they were. */
function fromForm(form: HTMLFormElement, previous: Override, title: string): Override {
  const data = new FormData(form);
  const num = (name: string) => {
    const v = String(data.get(name) ?? "").trim();
    return v === "" ? undefined : Number(v);
  };
  const text = (name: string) => String(data.get(name) ?? "").trim() || undefined;
  const clean = <T extends object>(obj: T) => {
    const out = Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
    return Object.keys(out).length ? (out as T) : undefined;
  };

  const o: Override = { ...previous };
  o.opencriticId = num("opencriticId");
  o.metacritic = clean({ critic: num("metacritic.critic"), criticCount: num("metacritic.criticCount"), user: num("metacritic.user"), userCount: num("metacritic.userCount") });
  o.backloggd = clean({ rating: num("backloggd.rating"), count: num("backloggd.count") });
  const managedLinks = {
    metacritic: text("links.metacritic"),
    wikipedia: text("links.wikipedia"),
    nintendoWiki: text("links.nintendoWiki"),
    nintendoStore: text("links.nintendoStore"),
  };
  const otherLinks = Object.fromEntries(Object.entries(previous.links ?? {}).filter(([k]) => !(k in managedLinks)));
  o.links = clean({ ...otherLinks, ...managedLinks }) as Record<string, string> | undefined;
  const ex = String(data.get("exclusivity"));
  o.exclusivity = ex === "" ? undefined : ex === "null" ? null : (ex as Game["exclusivity"]);
  const s1 = String(data.get("alsoOnSwitch1"));
  o.alsoOnSwitch1 = s1 === "" ? undefined : s1 === "true";
  o.developer = text("developer");
  o._title ??= title; // a reminder in overrides.json; ignored by the scripts
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
}

async function save(id: string, override: Override | null) {
  const status = $<HTMLElement>(".admin-status");
  status.className = "admin-status";
  status.textContent = "Saving and rebuilding…";
  const res = await fetch(`/__admin/games/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(override),
  });
  const result = (await res.json()) as { ok?: boolean; errors?: string[]; error?: string; output?: string; removed?: boolean };
  if (!res.ok) {
    status.className = "admin-status is-error";
    status.textContent = result.errors?.join(" · ") ?? `${result.error}${result.output ? `: ${result.output}` : ""}`;
    return;
  }
  // The server also broadcasts "games-updated"; reloading here keeps the editor on this game.
  await load();
  const after = $<HTMLElement>(".admin-status");
  after.className = "admin-status is-ok";
  after.textContent = result.removed ? "Override removed, games.json rebuilt." : "Saved, games.json rebuilt.";
  // The build has no network: a forced id outside the cached OpenCritic data gets its score from data:fetch.
  const game = state.games.find((x) => x.id === id);
  if (override?.opencriticId && game && released(game) && !game.scores.critic.opencritic) {
    after.textContent += " The OpenCritic score arrives with the next `npm run data:fetch`.";
  }
}

$<HTMLInputElement>("#search").addEventListener("input", (e) => {
  state.query = (e.target as HTMLInputElement).value;
  renderList();
});
renderFilters();
void load();
