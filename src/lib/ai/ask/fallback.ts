// Every Ask AI step has a non-AI fallback, so the demo works with no API key
// and survives a failed or slow model call.
import "server-only";

/** Longest we wait for one AI step before using its fallback, so a slow model never stalls a screen. */
export const AI_TIMEOUT_MS = 12_000;

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function withFallback<T>(
  label: string,
  run: () => Promise<T>,
  fallback: () => T,
  timeoutMs: number = AI_TIMEOUT_MS,
) {
  if (!aiEnabled()) return fallback();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  try {
    const result = await Promise.race([run(), timedOut]);
    if (result === "timeout") {
      console.error(`[ai:${label}] timed out after ${timeoutMs} ms, using fallback`);
      return fallback();
    }
    return result;
  } catch (error) {
    console.error(`[ai:${label}] failed, using fallback:`, error);
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
