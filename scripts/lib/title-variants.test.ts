import { describe, expect, it } from "vitest";
import { slugify } from "./metacritic";
import { reducedTitles, titleVariants } from "./title-variants";

describe("titleVariants", () => {
  it("drops the Switch 2 Edition suffix, then the bundle, then Definitive Edition", () => {
    expect(titleVariants("Xenoblade Chronicles: Definitive Edition - Nintendo Switch 2 Edition")).toEqual([
      "Xenoblade Chronicles: Definitive Edition - Nintendo Switch 2 Edition",
      "Xenoblade Chronicles: Definitive Edition",
      "Xenoblade Chronicles",
    ]);
    expect(titleVariants("Kirby and the Forgotten Land: Nintendo Switch 2 Edition + Star-Crossed World")).toEqual([
      "Kirby and the Forgotten Land: Nintendo Switch 2 Edition + Star-Crossed World",
      "Kirby and the Forgotten Land",
    ]);
    expect(reducedTitles("Super Mario Galaxy + Super Mario Galaxy 2")).toEqual(["Super Mario Galaxy"]);
    expect(reducedTitles("Hyrule Warriors: Age of Calamity - Definitive Edition")).toEqual(["Hyrule Warriors: Age of Calamity"]);
  });

  it("leaves plain titles alone", () => {
    expect(titleVariants("Super Mario Galaxy")).toEqual(["Super Mario Galaxy"]);
    expect(titleVariants("Pokémon Legends: Z-A")).toEqual(["Pokémon Legends: Z-A"]);
  });

  it("gives the Metacritic slugs of the base games", () => {
    expect(reducedTitles("Animal Crossing: New Horizons - Nintendo Switch 2 Edition").map(slugify)).toContain("animal-crossing-new-horizons");
    expect(reducedTitles("Xenoblade Chronicles: Definitive Edition - Nintendo Switch 2 Edition").map(slugify)).toContain("xenoblade-chronicles-definitive-edition");
    expect(reducedTitles("Fitness Boxing 3: Your Personal Trainer - Nintendo Switch 2 Edition").map(slugify)).toContain("fitness-boxing-3-your-personal-trainer");
  });
});
