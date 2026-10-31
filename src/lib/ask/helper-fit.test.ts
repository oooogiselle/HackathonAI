import { describe, expect, it } from "vitest";

import { cleanSkills, cleanTags, guessSkills } from "./helper-fit";

describe("cleanTags", () => {
  it("lowercases, trims, dedupes and drops junk", () => {
    expect(cleanTags(["Airport", " airport ", "IKEA furniture!", "x", ""])).toEqual([
      "airport",
      "ikea furniture",
    ]);
  });

  it("never keeps contact details", () => {
    expect(cleanTags(["kai@dartmouth.edu", "603-555-0142", "(603) 555 0142", "car"])).toEqual([
      "car",
    ]);
  });

  it("caps the count", () => {
    expect(cleanTags(["a1", "b2", "c3"], 2)).toHaveLength(2);
  });
});

describe("cleanSkills", () => {
  it("keeps only known interests and at most 6 tags", () => {
    const out = cleanSkills({
      interests: ["rides", "skydiving"],
      tags: ["a1", "b2", "c3", "d4", "e5", "f6", "g7"],
    });
    expect(out.interests).toEqual(["rides"]);
    expect(out.tags).toHaveLength(6);
  });
});

describe("guessSkills", () => {
  it("picks known tags and their interests from plain words", () => {
    const out = guessSkills("I have a car and can drive people to the airport. I also cook.");
    expect(out.tags).toEqual(expect.arrayContaining(["car", "drive", "airport", "cook"]));
    expect(out.interests).toEqual(expect.arrayContaining(["rides", "cooking"]));
  });

  it("returns nothing for unrelated text", () => {
    expect(guessSkills("hello there")).toEqual({ interests: [], tags: [] });
  });
});
