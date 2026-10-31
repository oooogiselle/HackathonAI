// One adapter per email channel. Tonight only the console adapter exists.
export type Email = { to: string; subject: string; text: string };

export interface EmailAdapter {
  /** True when the env vars this adapter needs are set. */
  isConfigured(): boolean;
  send(email: Email): Promise<void>;
}
