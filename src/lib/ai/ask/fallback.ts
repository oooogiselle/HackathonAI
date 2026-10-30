// Every Ask AI step has a non-AI fallback, so the demo works with no API key
// and survives a failed or slow model call.
import "server-only";

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function withFallback<T>(label: string, run: () => Promise<T>, fallback: () => T) {
  if (!aiEnabled()) return fallback();
  try {
    return await run();
  } catch (error) {
    console.error(`[ai:${label}] failed, using fallback:`, error);
    return fallback();
  }
}
