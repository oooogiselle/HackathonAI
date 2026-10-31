import { describe, expect, it } from "vitest";

import {
  campusTags,
  canonicalTag,
  communityTagsIn,
  greekIn,
  houseIn,
  isCommunityTag,
  mentionsTag,
  stripGreek,
} from "./dartmouth";

describe("mentionsTag", () => {
  it("matches whole words only", () => {
    expect(mentionsTag("I need a car", "car")).toBe(true);
    expect(mentionsTag("help me carry boxes", "car")).toBe(false);
    expect(mentionsTag("my physics homework", "cs")).toBe(false);
    expect(mentionsTag("my physics homework", "work")).toBe(false);
    expect(mentionsTag("can you provide a ride", "id")).toBe(false);
    expect(mentionsTag("lost my student ID", "id")).toBe(true);
  });

  it("counts plurals and multi-word tags", () => {
    expect(mentionsTag("two rides this week", "ride")).toBe(true);
    expect(mentionsTag("the Social Security office", "social security")).toBe(true);
  });
});

describe("campusTags", () => {
  it("reads Dartmouth words as the help they imply", () => {
    expect(campusTags("Dartmouth Coach to Logan on Saturday")).toEqual(
      expect.arrayContaining(["airport", "ride"]),
    );
    expect(campusTags("advice on pairing COSC 10 with Math 8")).toEqual(
      expect.arrayContaining(["cs", "course"]),
    );
    expect(campusTags("borrow something from the DOC gear room")).toContain("gear");
  });

  it("only treats DOC in capitals as the Outing Club", () => {
    expect(campusTags("can a doc look at this")).toEqual([]);
  });
});

describe("houseIn", () => {
  it("finds the house by its name or one of its halls", () => {
    expect(houseIn("I live in South House")?.name).toBe("South House");
    expect(houseIn("pick me up at Fahey")?.name).toBe("West House");
    expect(houseIn("from Fayerweather room 2")?.name).toBe("South House");
    expect(houseIn("near East Wheelock")?.name).toBe("East Wheelock House");
  });

  it("needs 'Hall' after names that are also everyday words", () => {
    expect(houseIn("a little help with a brown couch")).toBeNull();
    expect(houseIn("Little Hall basement")?.name).toBe("School House");
  });
});

describe("Greek houses", () => {
  it("finds a house by name or nickname", () => {
    expect(greekIn("carry a couch to Psi U")?.name).toBe("Psi Upsilon");
    expect(greekIn("party at Heorot")?.name).toBe("Chi Heorot");
    expect(greekIn("meet at the Tabard")?.name).toBe("The Tabard");
    expect(greekIn("Alpha Phi Alpha step show")?.name).toBe("Alpha Phi Alpha");
  });

  it("ignores Greek letters inside ordinary text", () => {
    expect(greekIn("my beta version and theta values")).toBeNull();
    expect(greekIn("aka the airport")).toBeNull();
  });

  it("strips Greek names from text shown to other students", () => {
    expect(stripGreek("Lives at Psi U, has a car")).toBe("Lives at a Greek house, has a car");
  });
});

describe("community tags", () => {
  it("stores typed names in one form", () => {
    expect(canonicalTag("psi u")).toBe("psi upsilon");
    expect(canonicalTag("fahey")).toBe("west house");
    expect(canonicalTag("korean")).toBe("korean");
  });

  it("tells community tags from skills", () => {
    expect(isCommunityTag("west house")).toBe(true);
    expect(isCommunityTag("psi upsilon")).toBe(true);
    expect(isCommunityTag("car")).toBe(false);
  });

  it("collects the house and Greek house an ask names", () => {
    expect(communityTagsIn("from Fahey to Psi U")).toEqual(["west house", "psi upsilon"]);
  });
});
