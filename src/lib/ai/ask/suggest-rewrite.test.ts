import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The model, when a test turns AI on.
const generateText = vi.fn();
vi.mock("ai", async (actual) => ({
  ...(await actual<typeof import("ai")>()),
  generateText: (...args: unknown[]) => generateText(...args),
}));

const { fallbackRewrite, isSafeRewrite, subjectOf, suggestRewrite } =
  await import("./suggest-rewrite");
const { keywordCheck } = await import("./safety-check");

const BLOCKED = [
  "Write my 5-page history essay. Due Monday, I'll send the prompt.",
  "Can someone do my econ problem set tonight?",
  "Finish my CS homework for $20",
  "Take my chem exam for me",
  "Write my essay. History class, due Friday.",
];

beforeEach(() => {
  generateText.mockReset();
  vi.stubEnv("ANTHROPIC_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("suggestRewrite", () => {
  it("only gets asked for things the keyword check blocks as graded work", () => {
    for (const ask of BLOCKED) expect(keywordCheck(ask).category).toBe("academic");
  });

  it("keeps the subject when there is one", () => {
    expect(subjectOf("Write my 5-page history essay")).toBe("history ");
    expect(subjectOf("do my econ problem set")).toBe("econ ");
    expect(subjectOf("Write my essay. History class, due Friday.")).toBe("history ");
    expect(subjectOf("Write my essay")).toBe("");
  });

  it("falls back to an honest ask that passes Quick check, for every kind of work", () => {
    for (const ask of BLOCKED) {
      const r = fallbackRewrite(ask);
      expect(isSafeRewrite(r), `${ask} -> ${r.text}`).toBe(true);
      expect(r.text).not.toMatch(/\b(write|do|finish|take)\b/i);
    }
    expect(fallbackRewrite(BLOCKED[0]).what).toBe("Talk through my history essay outline");
    expect(fallbackRewrite(BLOCKED[3]).what).toBe("Study partner before my chem exam");
  });

  it("uses the canned rewrite with no API key", async () => {
    const r = await suggestRewrite(BLOCKED[1]);
    expect(r.what).toBe("Explain a concept from my econ class");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("uses the model's rewrite when it's safe, clamped to sane limits", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    generateText.mockResolvedValue({
      output: {
        what: "  Talk through my history essay ideas ",
        text: "Looking for someone to talk through my thesis ideas for my history essay.",
        minutes: 500,
      },
    });
    expect(await suggestRewrite(BLOCKED[0])).toEqual({
      what: "Talk through my history essay ideas",
      text: "Looking for someone to talk through my thesis ideas for my history essay.",
      minutes: 90,
    });
  });

  it("never passes on a model rewrite that is still graded work", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    generateText.mockResolvedValue({
      output: { what: "Essay help", text: "Please write my history essay for me.", minutes: 60 },
    });
    expect(await suggestRewrite(BLOCKED[0])).toEqual(fallbackRewrite(BLOCKED[0]));
  });

  it("falls back when the model call fails", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    generateText.mockRejectedValue(new Error("overloaded"));
    expect(await suggestRewrite(BLOCKED[2])).toEqual(fallbackRewrite(BLOCKED[2]));
  });
});
