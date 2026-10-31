import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_TIMEOUT_MS, withFallback } from "./fallback";

describe("withFallback", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns the AI result when it arrives in time", async () => {
    await expect(withFallback("t", async () => "ai", () => "fallback")).resolves.toBe("ai");
  });

  it("uses the fallback when the AI call throws", async () => {
    const run = async () => {
      throw new Error("boom");
    };
    await expect(withFallback("t", run, () => "fallback")).resolves.toBe("fallback");
  });

  it("uses the fallback when the AI call hangs past the timeout", async () => {
    vi.useFakeTimers();
    const pending = withFallback("t", () => new Promise<string>(() => {}), () => "fallback");
    await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS);
    await expect(pending).resolves.toBe("fallback");
  });

  it("skips the model entirely with no API key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const run = vi.fn(async () => "ai");
    await expect(withFallback("t", run, () => "fallback")).resolves.toBe("fallback");
    expect(run).not.toHaveBeenCalled();
  });
});
