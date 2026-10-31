import { spawn, spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

export type ProcResult = { code: number; stdout: string; stderr: string };

/** Runs a command to completion. Optional stdin, and a log file that gets stdout + stderr as they arrive. */
export function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; input?: string; logFile?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<ProcResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk;
      if (opts.logFile) appendFileSync(opts.logFile, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk;
      if (opts.logFile) appendFileSync(opts.logFile, chunk);
    });
    child.on("error", (err) => resolve({ code: 127, stdout, stderr: stderr + String(err) }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.stdin.end(opts.input ?? "");
  });
}

/** Synchronous helper for quick git/gh calls. Throws with stderr on a non-zero exit. */
export function sh(cmd: string, args: string[], cwd?: string): string {
  const res = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (${res.status}): ${res.stderr || res.stdout}`);
  }
  return res.stdout.trim();
}

/** Like `sh`, but returns null instead of throwing. */
export function trySh(cmd: string, args: string[], cwd?: string): string | null {
  try {
    return sh(cmd, args, cwd);
  } catch {
    return null;
  }
}

export function tail(text: string, lines: number): string {
  return text.split("\n").slice(-lines).join("\n");
}
