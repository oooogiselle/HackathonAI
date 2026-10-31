import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/groups", () => ({ postToGroup: vi.fn(async () => {}) }));
// Keyword matching and keyword safety, no API calls.
vi.stubEnv("ANTHROPIC_API_KEY", "");
vi.stubEnv("OPENAI_API_KEY", "");

const { findCommonNeed } = await import("./ask");
const { aliasFor } = await import("@/lib/ask/alias");

describe("findCommonNeed", () => {
  it("returns the need with a tip and only the helper's public fields", async () => {
    const match = await findCommonNeed("Ride to Manchester airport. Two suitcases, flight at 10am");
    expect(match).toMatchObject({ id: "airport", askedLastTerm: 14 });
    expect(match?.tip).toMatch(/week before break/);
    // No free/busy, tags, weekly limit or payment status.
    // An alias, never the helper's name.
    expect(match?.from).toEqual({ id: "mei", alias: aliasFor("mei"), year: "Junior" });
  });

  it("returns null when nothing matches", async () => {
    expect(await findCommonNeed("Fix my bike chain")).toBeNull();
  });

  it("never shows a tip for crisis or schoolwork, even if a need matches", async () => {
    expect(
      await findCommonNeed("I want to end my life, I can't get a ride to the airport"),
    ).toBeNull();
    expect(await findCommonNeed("Write my essay about getting an SSN")).toBeNull();
  });

  it("still shows tips for private topics", async () => {
    // Visa paperwork is sensitive (kept private), but a tip hurts nobody.
    expect((await findCommonNeed("Help with my SSN, my visa says F-1"))?.id).toBe("ssn");
  });

  it("rejects empty input", async () => {
    await expect(findCommonNeed("   ")).rejects.toThrow();
  });
});
