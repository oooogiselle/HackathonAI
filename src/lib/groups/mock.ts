// Used when a platform's env vars aren't set, so the demo never breaks.
import type { GroupAdapter } from "./types";

export const mockAdapter: GroupAdapter = {
  isConfigured: () => true,

  async post(group, text) {
    console.log(`[mock:${group.platform}] → ${group.name}\n${text}\n`);
  },
};
