// Demo shortcuts: the mocked "Sign in with Dartmouth" (no password, no codes)
// and showing verification codes on screen when nothing can send them.
// On in development and tests; off in production unless ASK_DEMO_MODE=1
// (set it on a demo deploy that has no email or SMS keys yet).
export function isDemoMode() {
  return process.env.NODE_ENV !== "production" || process.env.ASK_DEMO_MODE === "1";
}
