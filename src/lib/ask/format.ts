// The exact text posted to a group. Shared by the Share preview (client) and
// postAsk (server) so the preview always matches what's sent.
export function formatPostMessage(text: string, name: string | null, claimUrl: string) {
  const signature = name ? `— ${name} (via Ask)` : "— a fellow student (via Ask)";
  return `${text}\n${signature}\n\nCan help? Tap: ${claimUrl}`;
}

export const COVERED_MESSAGE = "Covered, thanks to whoever helped!";

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
