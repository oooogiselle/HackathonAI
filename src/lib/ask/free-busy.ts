// Weekly free/busy checks, shared by matching (server) and the time picker
// on Post a need (client). Slots are seeded tonight, never event titles.
import { HELPERS } from "./mock-data";
import type { BusySlot, Helper } from "./types";

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// True if [start, start + minutes) overlaps a busy slot. Local time, the
// same clock the seeded slots use. An ask that runs past midnight is checked
// against the next day too.
export function isBusyAt(busy: BusySlot[], startsAt: Date, minutes: number) {
  const day = startsAt.getDay();
  const from = startsAt.getHours() * 60 + startsAt.getMinutes();
  const to = from + Math.max(minutes, 1);
  return busy.some((slot) => {
    const start = toMinutes(slot.start);
    const end = toMinutes(slot.end);
    if (slot.day === day) return from < end && start < to;
    if (slot.day === (day + 1) % 7) return to > 24 * 60 && start < to - 24 * 60;
    return false;
  });
}

export type FreeSlot = { at: Date; helpersFree: number };

const STEP_MIN = 30;
const FIRST_HOUR = 8;
const LAST_START_HOUR = 22;

/**
 * Times in the next few days when the asker is free for the whole ask, each
 * with how many of `helpers` are free then too. Per day, the times with the
 * most helpers free (then soonest), at most `perDay`; `limit` in all, in
 * time order.
 */
export function freeSlots({
  busy,
  minutes,
  days = 3,
  from = new Date(),
  limit = 6,
  perDay = 2,
  helpers = HELPERS,
}: {
  busy: BusySlot[];
  minutes: number;
  days?: number;
  from?: Date;
  limit?: number;
  perDay?: number;
  helpers?: Helper[];
}): FreeSlot[] {
  const picked: FreeSlot[] = [];
  for (let d = 0; d < days; d++) {
    const slots: FreeSlot[] = [];
    for (let m = FIRST_HOUR * 60; m <= LAST_START_HOUR * 60; m += STEP_MIN) {
      const at = new Date(from.getFullYear(), from.getMonth(), from.getDate() + d, 0, m);
      if (at <= from || isBusyAt(busy, at, minutes)) continue;
      const helpersFree = helpers.filter((h) => !isBusyAt(h.busy, at, minutes)).length;
      slots.push({ at, helpersFree });
    }
    slots.sort((a, b) => b.helpersFree - a.helpersFree || a.at.getTime() - b.at.getTime());
    picked.push(...slots.slice(0, perDay));
  }
  return picked.slice(0, limit).sort((a, b) => a.at.getTime() - b.at.getTime());
}
