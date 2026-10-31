import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
vi.mock("ai", async (orig) => ({ ...(await orig<typeof import("ai")>()), generateText }));

const { fallbackScrub, privacyScrub } = await import("./privacy-scrub");

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  generateText.mockReset();
});

describe("privacy scrub keyword pass", () => {
  it("turns a hall and room into its house community", () => {
    const out = fallbackScrub("Carry 4 boxes from Fahey room 214 on Friday");
    expect(out.text).toBe("Carry 4 boxes from West House on Friday");
    expect(out.removed).toEqual(["from Fahey room 214"]);
  });

  it("keeps a house community, which is already broad", () => {
    expect(fallbackScrub("Ride from East Wheelock").removed).toEqual([]);
  });

  it("turns a Greek house into 'a Greek house'", () => {
    const out = fallbackScrub("Need a hand moving a couch to Psi U");
    expect(out.text).toBe("Need a hand moving a couch to a Greek house");
    expect(out.removed).toEqual(["Psi U"]);
  });

  it("keeps the old dorm rules for halls outside a house", () => {
    expect(fallbackScrub("I'm in McLaughlin room 3").text).toBe("I'm on campus");
  });
});

describe("privacyScrub with the model", () => {
  it("still runs the keyword pass on the model's result", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test");
    generateText.mockResolvedValue({
      output: { text: "Carry boxes to Heorot, Friday", removed: ["Ana"] },
    });
    const out = await privacyScrub("Ana here. Carry boxes to Heorot, Friday");
    expect(out.text).toBe("Carry boxes to a Greek house, Friday");
    expect(out.removed).toEqual(["Ana", "Heorot"]);
  });
});
