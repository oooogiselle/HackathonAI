import type { Group } from "@/lib/ask/types";

// One adapter per chat platform. Post-only: adapters never read messages.
export interface GroupAdapter {
  /** True when the env vars this adapter needs are set. */
  isConfigured(): boolean;
  post(group: Group, text: string): Promise<void>;
}
