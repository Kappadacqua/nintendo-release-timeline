import { describe, expect, it } from "vitest";
import { isGameDescription } from "./links";

describe("isGameDescription", () => {
  it("accepts single video games only", () => {
    expect(isGameDescription("2007 video game")).toBe(true);
    expect(isGameDescription("2020 hack and slash video game")).toBe(true);
    expect(isGameDescription("Video game series")).toBe(false);
    expect(isGameDescription("Japanese media franchise")).toBe(false);
    expect(isGameDescription("Fictional character")).toBe(false);
    expect(isGameDescription(undefined)).toBe(false);
  });
});
