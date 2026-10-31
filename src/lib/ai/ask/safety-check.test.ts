import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { keywordCheck, safetyCheck } from "./safety-check";

beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", ""));
afterEach(() => vi.unstubAllEnvs());

const cases: [string, string][] = [
  ["I want to die", "crisis"],
  ["I keep thinking about hurting myself", "crisis"],
  ["I don't want to be alive anymore", "crisis"],
  ["Write my 5-page history essay", "academic"],
  ["Can someone do my econ problem set tonight?", "academic"],
  ["Finish my CS homework for $20", "academic"],
  ["Take my chem exam for me", "academic"],
  ["take my midterm", "academic"],
  ["do my calc pset", "academic"],
  ["write my lab report", "academic"],
  ["Help with my I-20 paperwork", "sensitive"],
  ["Can I borrow money until Friday", "sensitive"],
  ["Ride to Lebanon airport Friday", "none"],
  ["Quiz me before my chem exam", "none"],
  ["Talk through my history essay outline", "none"],
  ["Which option is better for a dorm fridge", "none"],
];

describe("keywordCheck (no AI)", () => {
  it.each(cases)("%s -> %s", (text, category) => {
    expect(keywordCheck(text).category).toBe(category);
  });

  it("is what safetyCheck returns with no API key", async () => {
    expect((await safetyCheck("Take my chem exam for me")).category).toBe("academic");
  });
});
