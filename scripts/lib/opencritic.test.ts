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
