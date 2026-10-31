import { defineConfig, devices } from "@playwright/test";

// The e2e run gets its own dev server: its own port and build folder (so it can
// run next to `pnpm dev`), a fresh local database (so the 3-posts-per-group limit
// never trips), and blank keys. Blank GROUPME_BOT_ID / SLACK_WEBHOOK_URL keep the
// bot on the mock adapter even when .env.local has real ones; a blank
// ANTHROPIC_API_KEY makes every AI step use the canned fallback, so runs are
// fast and repeatable. Existing env vars win over .env.local in Next.
// E2E_PORT lets a second run go next to one already on 3100 (own build folder).
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
  },
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_DIST_DIR: PORT === 3100 ? ".next-e2e" : `.next-e2e-${PORT}`,
      // Local PGlite, never the shared Supabase database (even if .env.local sets ASK_DB).
      ASK_DB: "",
      NEXT_PUBLIC_SITE_URL: baseURL,
      ANTHROPIC_API_KEY: "",
      OPENAI_API_KEY: "",
      GROUPME_BOT_ID: "",
      SLACK_WEBHOOK_URL: "",
      GMAIL_USER: "",
      GMAIL_APP_PASSWORD: "",
    },
  },
});
