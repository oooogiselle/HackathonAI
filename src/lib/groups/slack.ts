// Slack incoming webhook: https://api.slack.com/messaging/webhooks
// TODO: interactive "I can help" buttons need a Slack app, not a webhook.
import type { GroupAdapter } from "./types";

export const slackAdapter: GroupAdapter = {
  isConfigured: () => Boolean(process.env.SLACK_WEBHOOK_URL),

  async post(_group, text) {
    const res = await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Slack post failed: ${res.status}`);
  },
};
