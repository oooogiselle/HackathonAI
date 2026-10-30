// The exact text posted to a group. Shared by the Share preview (client) and
// postAsk (server) so the preview always matches what's sent.
export function formatPostMessage(text: string, name: string | null, claimUrl: string) {
  const signature = name ? `— ${name} (via Ask)` : "— a fellow student (via Ask)";
  return `${text}\n${signature}\n\nCan help? Tap: ${claimUrl}`;
}

export const COVERED_MESSAGE = "✅ Covered, thanks to whoever helped!";
