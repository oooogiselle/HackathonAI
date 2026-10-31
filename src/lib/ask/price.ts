// Suggested price for one ask, from the time it takes. Deterministic (not the
// model) so the demo's $15 ride is reliable and the no-key fallback matches.
import type { Interest, PriceSuggestion } from "./types";

type Rate = { perHour: number; floor: number; note: string; activity: string };

const RIDE: Rate = { perHour: 20, floor: 10, note: "gas included", activity: "driving" };
const MOVING: Rate = { perHour: 20, floor: 10, note: "heavy lifting", activity: "moving" };
const KNOW_HOW: Rate = { perHour: 15, floor: 5, note: "time + know-how", activity: "help" };

// Small enough that most people ask as a favor.
const FAVOR_MINUTES = 10;

function rateFor(interests: Interest[]): Rate {
  if (interests.includes("rides")) return RIDE;
  if (interests.includes("moving")) return MOVING;
  return KNOW_HOW;
}

const roundTo5 = (n: number) => Math.round(n / 5) * 5;

export function suggestPrice(minutes: number, interests: Interest[]): PriceSuggestion {
  if (minutes <= FAVOR_MINUTES) {
    return {
      min: 0,
      max: 5,
      suggested: 0,
      reason: `About ${minutes} min`,
      favorHint: "Small enough that most people ask as a favor.",
    };
  }
  const rate = rateFor(interests);
  const suggested = Math.max(rate.floor, roundTo5((minutes / 60) * rate.perHour));
  return {
    min: Math.max(0, suggested - 5),
    max: suggested + 5,
    suggested,
    reason: `About ${minutes} min of ${rate.activity} × ~$${rate.perHour}/hr, ${rate.note} → $${suggested}`,
  };
}
