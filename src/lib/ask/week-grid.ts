// The Me tab's "When you're free" grid: 7 days x 3 parts of the day, built on
// the same weekly free/busy slots matching reads (never event titles).
import type { BusySlot } from "./types";

export const DAY_PARTS = [
  { key: "morning", label: "Morning", start: "08:00", end: "12:00" },
  { key: "afternoon", label: "Afternoon", start: "12:00", end: "17:00" },
  { key: "evening", label: "Evening", start: "17:00", end: "22:00" },
] as const;

// Monday first; values are BusySlot days (0 = Sunday).
export const WEEK_DAYS = [
  { day: 1, short: "M", name: "Monday" },
  { day: 2, short: "T", name: "Tuesday" },
  { day: 3, short: "W", name: "Wednesday" },
  { day: 4, short: "T", name: "Thursday" },
  { day: 5, short: "F", name: "Friday" },
  { day: 6, short: "S", name: "Saturday" },
  { day: 0, short: "S", name: "Sunday" },
] as const;

export const cellKey = (day: number, part: number) => `${day}-${part}`;

/** Cells with no busy slot overlapping them. */
export function freeCells(busy: BusySlot[]): Set<string> {
  const free = new Set<string>();
  for (const { day } of WEEK_DAYS) {
    DAY_PARTS.forEach((part, i) => {
      const taken = busy.some((s) => s.day === day && s.start < part.end && s.end > part.start);
      if (!taken) free.add(cellKey(day, i));
    });
  }
  return free;
}

/** Busy slots for every cell that isn't free, joining neighbors on the same day. */
export function busyFromFree(free: Set<string>): BusySlot[] {
  const busy: BusySlot[] = [];
  for (const { day } of WEEK_DAYS) {
    DAY_PARTS.forEach((part, i) => {
      if (free.has(cellKey(day, i))) return;
      const last = busy.at(-1);
      if (last && last.day === day && last.end === part.start) last.end = part.end;
      else busy.push({ day, start: part.start, end: part.end });
    });
  }
  return busy;
}

/** "Tue evening, Thu afternoon" style summary of up to `max` free cells. */
export function freeSummary(free: Set<string>, max = 3): string {
  const names: string[] = [];
  for (const { day, name } of WEEK_DAYS) {
    DAY_PARTS.forEach((part, i) => {
      if (free.has(cellKey(day, i))) names.push(`${name.slice(0, 3)} ${part.label.toLowerCase()}`);
    });
  }
  if (names.length === 0) return "No free times set";
  if (names.length === WEEK_DAYS.length * DAY_PARTS.length) return "Any time this week";
  if (names.length > 12) return "Most of the week";
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} +${names.length - max} more` : shown;
}
