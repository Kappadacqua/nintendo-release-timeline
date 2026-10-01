import { describe, expect, it } from "vitest";
import { isDue, layoutIssue, type MetacriticEntry, parseMetacriticPage, parseSearchResults, sameName, slugFromUrl, slugify } from "./metacritic";

const DAY = 86_400_000;

/** Same structure as a real game page (Nuxt markup trimmed). */
function page({ name = "Hades II", cards = "", users = "" } = {}) {
  return `<html><head><script type="application/ld+json">{"@type":"VideoGame","name":"${name}","aggregateRating":{"ratingValue":95,"reviewCount":56}}</script></head><body>
<section><div data-testid="all-platforms"><h2>All Platforms</h2>${cards}</div></section>
<section><div data-testid="user-reviews">${users}</div></section></body></html>`;
}
const card = (platform: string, score: string, count: number) =>
  `<a data-testid="product-score-card" href="/game/hades-ii/critic-reviews/?platform=${platform}"><div><p>Based on ${count} Critic Reviews</p></div><div><div title="Metascore ${score} out of 100" aria-label="Metascore ${score} out of 100"><span>${score}</span></div></div></a>`;
const users = (platform: string, score: string, count: string) =>
  `<h2><a href="/game/hades-ii/user-reviews/?platform=${platform}">User Reviews</a></h2><a data-testid="global-score-review-count-link">Based on ${count} User Ratings</a><div aria-label="User score ${score} out of 10"></div>`;

describe("slugify", () => {
  it("makes Metacritic slugs from titles", () => {
    expect(slugify("Pokémon Legends: Z-A")).toBe("pokemon-legends-z-a");
    expect(slugify("Marvel's Spider-Man 2")).toBe("marvels-spider-man-2");
    expect(slugify("Mario & Sonic")).toBe("mario-and-sonic");
    expect(slugify("Drag x Drive")).toBe("drag-x-drive");
  });

  it("reads the slug of a page URL", () => {
    expect(slugFromUrl("https://www.metacritic.com/game/hades-ii/")).toBe("hades-ii");
    expect(slugFromUrl("https://www.metacritic.com/game/hades-ii/critic-reviews/?platform=pc")).toBe("hades-ii");
    expect(slugFromUrl("https://example.com/")).toBeNull();
    expect(slugFromUrl(undefined)).toBeNull();
  });

  it("compares names without case, accents and punctuation", () => {
    expect(sameName("Super Mario Party Jamboree - Nintendo Switch 2 Edition + Jamboree TV", "Super Mario Party Jamboree: Nintendo Switch 2 Edition + Jamboree TV")).toBe(true);
    expect(sameName("Pokemon Legends Z-A", "Pokémon Legends: Z-A")).toBe(true);
    expect(sameName("Super Mario Party Jamboree", "Super Mario Party Jamboree: Nintendo Switch 2 Edition + Jamboree TV")).toBe(false);
  });
});

describe("parseMetacriticPage", () => {
  it("takes the Switch 2 Metascore and the user score of a Nintendo platform", () => {
    const html = page({ cards: card("pc", "94", 50) + card("nintendo-switch", "98", 5) + card("nintendo-switch-2", "95", 56), users: users("nintendo-switch-2", "8.5", "1,850") });
    expect(parseMetacriticPage(html)).toEqual({ name: "Hades II", platform: "nintendo-switch-2", critic: 95, criticCount: 56, user: 8.5, userCount: 1850 });
  });

  it("falls back to the Switch card, then to the page-wide JSON-LD", () => {
    expect(parseMetacriticPage(page({ cards: card("pc", "94", 50) + card("nintendo-switch", "98", 5) }))).toMatchObject({ platform: "nintendo-switch", critic: 98, criticCount: 5 });
    expect(parseMetacriticPage(page())).toMatchObject({ platform: null, critic: 95, criticCount: 56 });
  });

  it("ignores the user score of another platform", () => {
    const html = page({ cards: card("nintendo-switch-2", "95", 56), users: users("pc", "8.1", "900") });
    expect(parseMetacriticPage(html)).toMatchObject({ user: null, userCount: null });
  });

  it("reads tbd / null scores as no score", () => {
    const html = page({ cards: card("nintendo-switch-2", "tbd", 3), users: users("nintendo-switch-2", "null", "2") });
    expect(parseMetacriticPage(html)).toMatchObject({ critic: null, criticCount: 3, user: null, userCount: 2 });
  });
});

describe("parseSearchResults", () => {
  it("lists slug and decoded name of each game", () => {
    const html = `<div data-testid="search-item"><a href="/game/super-mario-party-jamboree-nintendo-switch-2/"><div alt="Super Mario Party Jamboree: Nintendo Switch 2 Edition + Jamboree TV"></div></a></div>
<div data-testid="search-item"><a href="/game/marvels-spider-man-2/"><div alt="Marvel&#39;s Spider-Man 2"></div></a></div>`;
    expect(parseSearchResults(html)).toEqual([
      { slug: "super-mario-party-jamboree-nintendo-switch-2", name: "Super Mario Party Jamboree: Nintendo Switch 2 Edition + Jamboree TV" },
      { slug: "marvels-spider-man-2", name: "Marvel's Spider-Man 2" },
    ]);
  });
});

describe("isDue", () => {
  const now = Date.parse("2026-10-01T06:00:00Z");
  const entry = (status: MetacriticEntry["status"], daysAgo: number): MetacriticEntry => ({
    slug: "hades-ii",
    url: "https://www.metacritic.com/game/hades-ii/",
    status,
    checkedAt: new Date(now - daysAgo * DAY).toISOString(),
  });

  it("is due when never checked or the slug changed", () => {
    expect(isDue(undefined, "hades-ii", 10, now)).toBe(true);
    expect(isDue(entry("ok", 0), "hades-2", 10, now)).toBe(true);
  });

  it("refreshes a found page daily for 60 days after release, then weekly", () => {
    expect(isDue(entry("ok", 0.5), "hades-ii", 10, now)).toBe(false);
    expect(isDue(entry("ok", 0.95), "hades-ii", 10, now)).toBe(true); // a run a little earlier than yesterday's
    expect(isDue(entry("ok", 3), "hades-ii", 90, now)).toBe(false);
    expect(isDue(entry("ok", 7), "hades-ii", 90, now)).toBe(true);
  });

  it("retries a missing page after 3 days, 14 once the game is old", () => {
    expect(isDue(entry("not-found", 2), "hades-ii", 10, now)).toBe(false);
    expect(isDue(entry("not-found", 3), "hades-ii", 10, now)).toBe(true);
    expect(isDue(entry("mismatch", 10), "hades-ii", 60, now)).toBe(false);
    expect(isDue(entry("mismatch", 14), "hades-ii", 60, now)).toBe(true);
  });
});

/** A card while the Metascore is "tbd": a <div to="…">, label without "out of 100". */
const tbdCard = (platform: string) =>
  `<div to="/game/dk-challenge/critic-reviews/?platform=${platform}" data-testid="product-score-card"><div><span title="Nintendo Switch 2"></span></div><div><div title="Metascore tbd" aria-label="Metascore tbd"><span>tbd</span></div></div></div>`;

describe("pages without enough reviews", () => {
  it("read the tbd card as no Metascore, on its platform", () => {
    const html = page({ name: "DK Challenge", cards: tbdCard("nintendo-switch-2"), users: users("nintendo-switch-2", "5.8", "4") });
    expect(parseMetacriticPage(html)).toMatchObject({ platform: "nintendo-switch-2", critic: null, criticCount: null, user: 5.8, userCount: 4 });
    expect(layoutIssue(html)).toBeNull();
  });

  it("accept a TBD user score without a platform link", () => {
    const html = page({ cards: tbdCard("nintendo-switch-2"), users: '<div aria-label="User score TBD"></div>' });
    expect(parseMetacriticPage(html)).toMatchObject({ user: null, userCount: null });
    expect(layoutIssue(html)).toBeNull();
  });
});

describe("layoutIssue", () => {
  it("accepts the current layout", () => {
    expect(layoutIssue(page({ cards: card("nintendo-switch-2", "95", 56), users: users("nintendo-switch-2", "8.5", "1,850") }))).toBeNull();
  });

  it("names what a redesigned page no longer has", () => {
    expect(layoutIssue("<html><body>new design</body></html>")).toBe('not found: JSON-LD game data; "All Platforms" section (data-testid="all-platforms")');
    const renamedCards = page({ cards: '<a data-testid="score-card" href="?platform=nintendo-switch-2">95</a>' });
    expect(layoutIssue(renamedCards)).toMatch(/Metascore cards/);
    const renamedLabel = page({ cards: card("nintendo-switch-2", "95", 56), users: '<a href="?platform=nintendo-switch-2"></a><div aria-label="Users: 8.5"></div>' });
    expect(layoutIssue(renamedLabel)).toMatch(/user score/);
  });
});
