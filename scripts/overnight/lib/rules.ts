// Pure rules shared by the pipeline and its tests (no git or env access here).

/** Risk tags that keep an idea from running unattended; it waits for a human instead. */
export const RISKY_TAGS = [
  "safety",
  "crisis",
  "payments",
  "bot-posting",
  "auth",
  "schema",
  "privacy",
];

/** Paths where a passing change still gets "needs human eyes" on its PR. */
export const PROTECTED_PATHS = [
  "src/lib/ai/ask/safety-check.ts",
  "src/lib/groups/",
  "src/lib/ask/board-store.ts",
  "src/server/actions/session.ts",
  "src/db/schema/",
  "drizzle/",
];

/** The deadline after which no new task starts: the next STOP_AT (HH:MM local) after `start`. */
export function deadline(start: Date, stopAt: string): Date {
  const [h, m] = stopAt.split(":").map(Number);
  const d = new Date(start);
  d.setHours(h, m, 0, 0);
  if (d <= start) d.setDate(d.getDate() + 1);
  return d;
}
