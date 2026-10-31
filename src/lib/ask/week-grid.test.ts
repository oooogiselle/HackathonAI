import { describe, expect, it } from "vitest";

import { busyFromFree, cellKey, freeCells, freeSummary } from "./week-grid";

describe("week grid", () => {
  it("marks a cell busy when any slot overlaps it", () => {
    const free = freeCells([{ day: 2, start: "16:00", end: "18:00" }]);
    expect(free.has(cellKey(2, 1))).toBe(false); // Tue afternoon
    expect(free.has(cellKey(2, 2))).toBe(false); // Tue evening
    expect(free.has(cellKey(2, 0))).toBe(true);
    expect(free.size).toBe(19);
  });

  it("joins neighboring busy cells on a day", () => {
    const free = freeCells([]);
    free.delete(cellKey(3, 0));
    free.delete(cellKey(3, 1));
    expect(busyFromFree(free)).toEqual([{ day: 3, start: "08:00", end: "17:00" }]);
  });

  it("round-trips", () => {
    const free = new Set([cellKey(1, 2), cellKey(0, 0)]);
    expect(freeCells(busyFromFree(free))).toEqual(free);
  });

  it("summarizes free times", () => {
    expect(freeSummary(new Set())).toBe("No free times set");
    expect(freeSummary(freeCells([]))).toBe("Any time this week");
    expect(freeSummary(new Set([cellKey(2, 2), cellKey(4, 1)]))).toBe("Tue evening, Thu afternoon");
  });
});
