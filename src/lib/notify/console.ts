// Logs emails to the server console. The default tonight, and the fallback
// when no real adapter is configured, so the demo never breaks.
import type { EmailAdapter } from "./types";

export const consoleAdapter: EmailAdapter = {
  isConfigured: () => true,

  async send(email) {
    console.log(`[mock:email] → ${email.to}\nSubject: ${email.subject}\n${email.text}\n`);
  },
};
