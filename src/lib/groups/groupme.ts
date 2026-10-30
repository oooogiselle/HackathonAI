// GroupMe bot: https://dev.groupme.com/tutorials/bots
// Post-only. We never set a callback URL, so the bot can't read the group.
import type { GroupAdapter } from "./types";

export const groupmeAdapter: GroupAdapter = {
  isConfigured: () => Boolean(process.env.GROUPME_BOT_ID),

  async post(_group, text) {
    // TODO: one bot per partner group. For now every GroupMe group uses the same bot_id.
    const res = await fetch("https://api.groupme.com/v3/bots/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bot_id: process.env.GROUPME_BOT_ID, text }),
    });
    if (!res.ok) throw new Error(`GroupMe post failed: ${res.status}`);
  },
};
