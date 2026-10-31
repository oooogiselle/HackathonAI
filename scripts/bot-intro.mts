// One-time intro when the bot is added to a group:
//   pnpm bot:intro <groupId>
// Reads .env.local; without GROUPME_BOT_ID / SLACK_WEBHOOK_URL it only logs.
import { BOT_INTRO_MESSAGE } from "@/lib/ask/format";
import { findGroup, GROUPS } from "@/lib/ask/mock-data";
import { postToGroup } from "@/lib/groups";

const groupId = process.argv[2];
const group = groupId ? findGroup(groupId) : undefined;
if (!group) {
  console.error(`Usage: pnpm bot:intro <groupId>\nGroups: ${GROUPS.map((g) => g.id).join(", ")}`);
  process.exit(1);
}

await postToGroup(group, BOT_INTRO_MESSAGE);
console.log(`Intro posted to ${group.name}.`);
