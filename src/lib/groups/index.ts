// postToGroup(group, text): the only way Ask sends anything to a group chat.
// Only call it after an explicit user tap (see postAsk / claimAsk in
// src/server/actions/ask.ts). To add a platform: write an adapter, add it here.
import "server-only";

import type { Group, Platform } from "@/lib/ask/types";

import { groupmeAdapter } from "./groupme";
import { mockAdapter } from "./mock";
import { slackAdapter } from "./slack";
import type { GroupAdapter } from "./types";

const adapters: Record<Platform, GroupAdapter> = {
  groupme: groupmeAdapter,
  slack: slackAdapter,
};

export async function postToGroup(group: Group, text: string): Promise<void> {
  const adapter = adapters[group.platform];
  await (adapter.isConfigured() ? adapter : mockAdapter).post(group, text);
}
