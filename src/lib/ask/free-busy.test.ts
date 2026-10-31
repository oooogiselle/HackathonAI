import { describe, expect, it } from "vitest";

import { freeSlots } from "./free-busy";
import type { Helper } from "./types";

// Sat Nov 7 2026, 9:00 local.
const FROM = new Date(2026, 10, 7, 9, 0);
const helper = (busy: Helper["busy"]): Helper => ({
  id: "h",
  firstName: "H",
  year: "Senior",
  blurb: "",
  tags: [],
  interests: [],
  busy,
  weeklyLimit: 3,
  canAcceptPayment: true,
});

describe("freeSlots", () => {
  it("skips past times and times the asker is busy", () => {
    const slots = freeSlots({
      busy: [{ day: 6, start: "10:00", end: "12:00" }],
      minutes: 30,
      days: 1,
      from: FROM,
      limit: 100,
      perDay: 100,
      helpers: [],
    });
    const hours = slots.map((s) => s.at.getHours() + s.at.getMinutes() / 60);
    expect(hours[0]).toBe(9.5);
    expect(hours).not.toContain(10);
    expect(hours).not.toContain(11.5);
    expect(hours).toContain(12);
  });

  it("needs the whole ask to fit before a busy slot", () => {
    const slots = freeSlots({
      busy: [{ day: 6, start: "11:00", end: "12:00" }],
      minutes: 60,
      days: 1,
      from: FROM,
      limit: 100,
      perDay: 100,
      helpers: [],
    });
    const hours = slots.map((s) => s.at.getHours() + s.at.getMinutes() / 60);
    expect(hours).toContain(10);
    expect(hours).not.toContain(10.5);
  });

  it("prefers times when more helpers are free, returned in time order", () => {
    const busyMorning = helper([{ day: 6, start: "08:00", end: "13:00" }]);
    const slots = freeSlots({
      busy: [],
      minutes: 30,
      days: 1,
      from: FROM,
      limit: 2,
      helpers: [busyMorning, busyMorning],
    });
    expect(slots.map((s) => s.at.getHours())).toEqual([13, 13]);
    expect(slots[0].at < slots[1].at).toBe(true);
    expect(slots.every((s) => s.helpersFree === 2)).toBe(true);
  });
});
