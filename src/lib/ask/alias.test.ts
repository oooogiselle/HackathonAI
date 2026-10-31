import { describe, expect, it } from "vitest";

import { aliasFor } from "./alias";

describe("aliasFor", () => {
  it("is stable for a user", () => {
    expect(aliasFor("u_123")).toBe(aliasFor("u_123"));
  });

  it("looks like Adjective Noun NN", () => {
    expect(aliasFor("mei")).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ [1-9]\d$/);
  });

  it("spreads across users", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `user-${i}`);
    expect(new Set(ids.map(aliasFor)).size).toBeGreaterThan(195);
  });
});
