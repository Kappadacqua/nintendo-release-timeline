import { describe, expect, it } from "vitest";
import { studioState } from "./fandom";

describe("studioState", () => {
  // docs/review/data.md, [bassa] "`CLOSED` riconosce "former" anche dentro altre parole".
  it("reads defunct / former only as whole words in the categories", () => {
    expect(studioState(["Defunct companies"], "").active).toBe(false);
    expect(studioState(["Former Nintendo subsidiaries"], "").active).toBe(false);
    expect(studioState(["Platformer developers", "Performers"], "").active).toBe(true);
  });

  // docs/review/data.md, [bassa] "il campo `defunct` dell'infobox si trova solo a inizio riga".
  it("finds the infobox defunct field also with several parameters on one line", () => {
    expect(studioState([], "{{Infobox company\n| founded = 2000\n| defunct = 2020\n}}")).toMatchObject({ defunct: "2020", uncertain: true });
    expect(studioState([], "{{Infobox company | founded = 2000 | defunct = 2020 }}")).toMatchObject({ defunct: "2020", uncertain: true });
    expect(studioState([], "{{Infobox company | founded = 2000 }}")).toMatchObject({ defunct: "", uncertain: false });
  });
});
