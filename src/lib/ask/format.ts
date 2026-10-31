// The exact text posted to a group. Shared by the Share preview (client) and
// shareCardToGroup (server) so the preview always matches what's sent. Never
// signed with a name: every ask is anonymous.
export function formatPostMessage(text: string, claimUrl: string) {
  return `${text}\n— a fellow student (via DartAsk)\n\nCan help? Tap: ${claimUrl}`;
}

export const COVERED_MESSAGE = "Covered, thanks to whoever helped!";

// Posted once, by hand, when the bot joins a group (`pnpm bot:intro <groupId>`).
// Never part of a regular post.
export const BOT_INTRO_MESSAGE =
  "I post asks from DartAsk. I can't read your messages. Remove me anytime.";

// Rebuilds an ask's sentence from its fields: the no-AI fallback, and what the
// Your ask screen uses after the student edits What / When / Where. The price
// is a separate card field, so it isn't in the sentence.
export function composeAskText(part: {
  what: string;
  when?: string;
  where?: string;
  minutes: number;
}) {
  const what = part.what.trim().replace(/[.!?]+$/, "");
  const details = [part.when, part.where]
    .map((d) => d?.trim())
    .filter(Boolean)
    .join(", ");
  return `Hi! Could someone help me with this: ${what}${details ? ` (${details})` : ""}? About ${part.minutes} min. Thank you!`;
}
