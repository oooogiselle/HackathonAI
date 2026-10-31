import { describe, expect, it } from "vitest";

import {
  categoryStyle,
  guessCategoryFromText,
  normalizeCategory,
  rankCategoriesByKeyword,
} from "./categories";

describe("categories", () => {
  it("normalizes typed categories and reuses preset spelling", () => {
    expect(normalizeCategory("  rides ")).toBe("Rides");
    expect(normalizeCategory("bike   repair")).toBe("Bike repair");
    expect(normalizeCategory("")).toBe("Other");
    expect(normalizeCategory("x".repeat(40))).toHaveLength(24);
  });

  it("ranks presets and typed categories by keywords", () => {
    expect(guessCategoryFromText("Ride to Lebanon airport on Saturday")).toBe("Rides");
    expect(guessCategoryFromText("something unusual")).toBe("Other");
    expect(rankCategoriesByKeyword("my bike has a flat", ["Rides", "Bike repair"])).toEqual([
      "Bike repair",
    ]);
  });

  it("styles typed categories like Other", () => {
    expect(categoryStyle("Bike repair")).toBe(categoryStyle("Other"));
    expect(categoryStyle("rides")).not.toBe(categoryStyle("Other"));
  });
});
