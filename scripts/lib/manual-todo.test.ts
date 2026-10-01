import { describe, expect, it } from "vitest";
import { filledUrls, manualTodo } from "./manual-todo";

const games = [
  { id: "igdb:405439", title: "DK Challenge", date: "2026-06-09", gaps: [{ source: "Nintendo Wiki", state: "no page found" as const }, { source: "Nintendo Store", state: "no page found" as const }] },
];

describe("manualTodo", () => {
  it("lists one empty line per missing link", () => {
    const md = manualTodo(games, "2026-10-01");
    expect(md).toContain("## DK Challenge (`igdb:405439`, 2026-06-09)");
    expect(md).toContain("- Nintendo Wiki: \n- Nintendo Store: \n");
  });

  it("keeps the URLs already written by hand", () => {
    const edited = manualTodo(games, "2026-10-01").replace("- Nintendo Store: ", "- Nintendo Store: https://www.nintendo.com/us/store/products/dk-challenge/");
    expect(filledUrls(edited).get("igdb:405439|Nintendo Store")).toBe("https://www.nintendo.com/us/store/products/dk-challenge/");
    const again = manualTodo(games, "2026-10-02", edited);
    expect(again).toContain("- Nintendo Store: https://www.nintendo.com/us/store/products/dk-challenge/\n");
    expect(again).toContain("- Nintendo Wiki: \n");
  });
});
