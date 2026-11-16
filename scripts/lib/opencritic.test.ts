import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "./http";
import { OpenCritic } from "./opencritic";

/** Fake RapidAPI: search answers by criteria, everything logged. */
function stubSearch(answers: Record<string, { id: number; name: string; dist: number }[]>, status = 200) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    const criteria = new URL(url).searchParams.get("criteria") ?? "";
    calls.push(criteria);
    const body = status === 200 ? JSON.stringify(answers[criteria] ?? []) : '{"message":"You have exceeded the DAILY quota for Searches"}';
    return new Response(body, { status });
  });
  return calls;
}

const client = () => new OpenCritic("key", join(mkdtempSync(join(tmpdir(), "oc-")), "opencritic.json"), { searches: 10, requests: 10 });
const DE_S2 = "Xenoblade Chronicles: Definitive Edition - Nintendo Switch 2 Edition";

afterEach(() => vi.unstubAllGlobals());

describe("OpenCritic.resolveId", () => {
  it("falls back to the base game's title and never searches a found game again", async () => {
    const calls = stubSearch({ "Xenoblade Chronicles: Definitive Edition": [{ id: 9261, name: "Xenoblade Chronicles: Definitive Edition", dist: 0 }] });
    const oc = client();
    expect(await oc.resolveId("igdb:405446", DE_S2, 30)).toBe(9261);
    expect(calls).toEqual([DE_S2, "Xenoblade Chronicles: Definitive Edition"]);
    expect(await oc.resolveId("igdb:405446", DE_S2, 30)).toBe(9261);
    expect(calls).toHaveLength(2);
  });

  it("searches the base game's page again when due, and keeps the game's own page once found", async () => {
    const calls = stubSearch({ "Xenoblade Chronicles: Definitive Edition": [{ id: 9261, name: "Xenoblade Chronicles: Definitive Edition", dist: 0 }] });
    const oc = client();
    const now = Date.parse("2026-11-01T10:00:00Z");
    const later = (days: number) => now + days * 86_400_000;
    expect(await oc.resolveId("igdb:405446", DE_S2, 20, undefined, now)).toBe(9261);
    // 20 days after release: every 3 days. Not due after 2, due after 3 (base page kept meanwhile).
    expect(await oc.resolveId("igdb:405446", DE_S2, 22, undefined, later(2))).toBe(9261);
    expect(calls).toHaveLength(2);
    expect(await oc.resolveId("igdb:405446", DE_S2, 23, undefined, later(3))).toBe(9261);
    expect(calls).toHaveLength(4);
    // The Switch 2 Edition gets its own page: found, and never searched again.
    calls.length = 0;
    stubSearch({ [DE_S2]: [{ id: 22000, name: DE_S2, dist: 0 }] });
    expect(await oc.resolveId("igdb:405446", DE_S2, 30, undefined, later(10))).toBe(22000);
    expect(await oc.resolveId("igdb:405446", DE_S2, 400, undefined, later(400))).toBe(22000);
  });

  it("keeps the base game's page when a new search finds nothing", async () => {
    stubSearch({ "Xenoblade Chronicles: Definitive Edition": [{ id: 9261, name: "Xenoblade Chronicles: Definitive Edition", dist: 0 }] });
    const oc = client();
    const now = Date.parse("2026-11-01T10:00:00Z");
    await oc.resolveId("igdb:405446", DE_S2, 5, undefined, now);
    stubSearch({});
    expect(await oc.resolveId("igdb:405446", DE_S2, 6, undefined, now + 86_400_000)).toBe(9261);
  });

  it("does not search a miss again before the retry delay", async () => {
    const calls = stubSearch({});
    const oc = client();
    expect(await oc.resolveId("igdb:405439", "DK Challenge", 30)).toBeNull();
    expect(await oc.resolveId("igdb:405439", "DK Challenge", 30)).toBeNull();
    expect(calls).toEqual(["DK Challenge"]);
  });

  it("fails at once on a 429 (daily quota), without retrying", async () => {
    const calls = stubSearch({}, 429);
    const oc = client();
    await expect(oc.resolveId("igdb:405439", "DK Challenge", 30)).rejects.toBeInstanceOf(HttpError);
    expect(calls).toHaveLength(1);
    expect(oc.hasMatch("igdb:405439")).toBe(false); // still in the queue for the next run
  });
});
