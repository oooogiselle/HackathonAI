import { describe, expect, it } from "vitest";

import { COMMON_NEEDS, matchCommonNeedByKeyword } from "./common-needs";
import { HELPERS } from "./mock-data";

const matchId = (text: string) => matchCommonNeedByKeyword(text)?.id ?? null;

describe("matchCommonNeedByKeyword", () => {
  it("matches the needs that come back every term", () => {
    expect(matchId("How do I get an SSN? I just got a campus job")).toBe("ssn");
    expect(matchId("Need help opening a bank account")).toBe("bank");
    expect(matchId("Where can I get a SIM card or eSIM?")).toBe("phone");
    expect(matchId("Ride to Manchester airport. I have two suitcases")).toBe("airport");
    expect(matchId("Somewhere to keep my boxes in storage over the summer")).toBe("storage");
    expect(matchId("Help moving out of my dorm Friday")).toBe("moving");
    expect(matchId("Lend me a warm coat for a weekend")).toBe("winter");
  });

  it("matches nothing for asks that aren't common needs", () => {
    expect(matchId("Fix my bike chain")).toBeNull();
    expect(matchId("Lend me a calculator for my exam")).toBeNull();
    // "bank" inside another word isn't a bank account.
    expect(matchId("Help me carry a riverbank photo frame")).toBeNull();
  });
});

describe("COMMON_NEEDS", () => {
  it("attributes every tip to a seeded helper", () => {
    const ids = new Set(HELPERS.map((h) => h.id));
    for (const need of COMMON_NEEDS) expect(ids, need.id).toContain(need.helperId);
  });

  it("keeps tips free of contact details, links and emojis", () => {
    for (const need of COMMON_NEEDS) {
      expect(need.tip, need.id).not.toMatch(/\d{3}[-. ]?\d{3,4}/);
      expect(need.tip, need.id).not.toMatch(/https?:|www\.|@/);
      expect(need.tip, need.id).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("has unique ids", () => {
    expect(new Set(COMMON_NEEDS.map((n) => n.id)).size).toBe(COMMON_NEEDS.length);
  });
});
