// Every agent stage and every gate run is one `docker run` of the overnight image.
// Mounts: the task's worktree (read-only for read-only stages), the repo's .git read-only with
// only this worktree's admin folder writable, a node_modules volume per worktree, a shared pnpm
// store, and a throwaway HOME with just the copied skills. The only secret passed in is the
// Claude auth token; agent stages never get GitHub, Vercel, Supabase or app keys.

import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { config, STAGES, type Stage } from "./config";
import { worktreeGitDir } from "./git";
import { run, tail } from "./proc";

const uid = process.getuid?.() ?? 1000;
const gid = process.getgid?.() ?? 1000;
const STORE_VOLUME = "ask-overnight-pnpm-store";
const nodeModulesVolume = (wt: string) => `ask-overnight-nm-${basename(wt)}`;

/** App keys blanked in every container, so tests use the mock bot and canned AI fallbacks. */
const BLANK_APP_ENV = [
  "ANTHROPIC_API_KEY=",
  "OPENAI_API_KEY=",
  "GROUPME_BOT_ID=",
  "SLACK_WEBHOOK_URL=",
  "GMAIL_USER=",
  "GMAIL_APP_PASSWORD=",
  "ASK_DB=",
  "DATABASE_URL=",
];

type Mounts = { wt: string; readOnly: boolean; home?: string; skillsDir?: string };

function mountArgs({ wt, readOnly, home, skillsDir }: Mounts): string[] {
  const args = [
    "-v",
    `${config.commonDir}:${config.commonDir}:ro`,
    "-v",
    `${worktreeGitDir(wt)}:${worktreeGitDir(wt)}${readOnly ? ":ro" : ""}`,
    "-v",
    `${wt}:${wt}${readOnly ? ":ro" : ""}`,
    "-v",
    `${nodeModulesVolume(wt)}:${wt}/node_modules`,
    "-v",
    `${STORE_VOLUME}:/pnpm-store`,
  ];
  if (home) args.push("-v", `${home}:/home/agent`);
  if (skillsDir) {
    args.push("-v", `${join(skillsDir, "skills")}:/home/agent/.claude/skills:ro`);
    args.push("-v", `${join(skillsDir, "commands")}:/home/agent/.claude/commands:ro`);
  }
  return args;
}

function baseArgs(wt: string, home = "/tmp"): string[] {
  return [
    "run",
    "--rm",
    "-i",
    "--init",
    "--user",
    `${uid}:${gid}`,
    "-w",
    wt,
    "-e",
    `HOME=${home}`,
    "-e",
    "NEXT_TELEMETRY_DISABLED=1",
    "-e",
    "NO_COLOR=1",
    "-e",
    "FORCE_COLOR=0",
    ...BLANK_APP_ENV.flatMap((e) => ["-e", e]),
  ];
}

/** Named volumes are created root-owned; hand them to the host user once. */
async function ownVolumes(wt: string) {
  await run("docker", [
    "run",
    "--rm",
    "--user",
    "0",
    "-v",
    `${nodeModulesVolume(wt)}:/a`,
    "-v",
    `${STORE_VOLUME}:/b`,
    config.image,
    "chown",
    `${uid}:${gid}`,
    "/a",
    "/b",
  ]);
}

export function authEnv(): string[] {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return ["-e", "CLAUDE_CODE_OAUTH_TOKEN"];
  if (process.env.OVERNIGHT_ANTHROPIC_API_KEY) {
    return ["-e", `ANTHROPIC_API_KEY=${process.env.OVERNIGHT_ANTHROPIC_API_KEY}`];
  }
  return [];
}

/** `pnpm install` in the container, so node_modules has Linux binaries. */
export async function installDeps(wt: string, logFile: string): Promise<boolean> {
  await ownVolumes(wt);
  const res = await run(
    "docker",
    [
      ...baseArgs(wt),
      ...mountArgs({ wt, readOnly: false }),
      config.image,
      "pnpm",
      "install",
      "--frozen-lockfile",
      "--prefer-offline",
    ],
    { logFile },
  );
  return res.code === 0;
}

export type GateResult = {
  ok: boolean;
  failedStep: string | null;
  logTail: string;
  logFile: string;
};

// Each Vitest worker starts its own PGlite database; one worker per CPU runs Docker out of memory.
const testWorkers = Number(process.env.GATE_TEST_WORKERS) || 3;

export const GATE_STEPS: [string, string][] = [
  ["lint", "pnpm lint"],
  ["typecheck", "pnpm typecheck"],
  ["test", `pnpm test --maxWorkers=${testWorkers}`],
  ["test:e2e", "pnpm test:e2e"],
];

/** lint, typecheck, unit tests, e2e. Stops at the first failure. No Claude token in this container. */
export async function runGate(wt: string, logFile: string): Promise<GateResult> {
  writeFileSync(logFile, "");
  const script = GATE_STEPS.map(
    ([name, cmd]) => `echo "=== ${cmd}"; ${cmd} || { echo "GATE FAILED: ${name}"; exit 1; }`,
  ).join("\n");
  const res = await run(
    "docker",
    [
      ...baseArgs(wt),
      ...mountArgs({ wt, readOnly: false }),
      config.image,
      "bash",
      "-c",
      `exec 2>&1\n${script}`,
    ],
    { logFile },
  );
  const out = res.stdout + res.stderr;
  const failed = /GATE FAILED: (\S+)/.exec(out);
  return {
    ok: res.code === 0,
    failedStep: failed ? failed[1] : res.code === 0 ? null : "docker",
    logTail: tail(out, 120),
    logFile,
  };
}

export type AgentResult<T> = {
  ok: boolean;
  structured: T | null;
  text: string;
  cost: number;
  turns: number;
  error: string | null;
};

type CliJson = {
  result?: string;
  structured_output?: unknown;
  total_cost_usd?: number;
  num_turns?: number;
  is_error?: boolean;
  subtype?: string;
};

const READ_ONLY_TOOLS = [
  "Read",
  "Grep",
  "Glob",
  "Skill",
  "TodoWrite",
  "Bash(git diff:*)",
  "Bash(git log:*)",
  "Bash(git show:*)",
  "Bash(git status:*)",
  "Bash(ls:*)",
  "Bash(grep:*)",
  "Bash(rg:*)",
  "Bash(cat:*)",
  "Bash(head:*)",
  "Bash(wc:*)",
].join(",");
const WRITE_DENY = [
  "Bash(git push:*)",
  "Bash(git commit:*)",
  "Bash(git reset:*)",
  "Bash(git stash:*)",
  "Bash(git rebase:*)",
  "Bash(git checkout:*)",
  "Bash(git switch:*)",
  "Bash(gh:*)",
  "Bash(vercel:*)",
  "Bash(pnpm db:*)",
  "Bash(pnpm bot:*)",
].join(",");

/**
 * Runs one headless Claude stage in the container. The prompt goes in on stdin; with a schema,
 * the answer comes back as `structured`. Everything is logged under `outDir/<label>.*`.
 */
export async function runAgent<T>(opts: {
  stage: Stage;
  label: string;
  wt: string;
  prompt: string;
  schema?: object;
  budgetUsd: number;
  outDir: string;
  skillsDir: string;
}): Promise<AgentResult<T>> {
  const limits = STAGES[opts.stage];
  const home = join(opts.outDir, "homes", opts.label);
  mkdirSync(home, { recursive: true });
  writeFileSync(join(opts.outDir, `${opts.label}.prompt.md`), opts.prompt);

  const cli = [
    "claude",
    "-p",
    "--output-format",
    "json",
    "--max-turns",
    String(limits.turns),
    "--max-budget-usd",
    opts.budgetUsd.toFixed(2),
    ...(config.model ? ["--model", config.model] : []),
    ...(opts.schema ? ["--json-schema", JSON.stringify(opts.schema)] : []),
    ...(limits.readOnly
      ? ["--allowedTools", READ_ONLY_TOOLS, "--disallowedTools", "Edit,Write,NotebookEdit"]
      : ["--dangerously-skip-permissions", "--disallowedTools", WRITE_DENY]),
  ];
  const res = await run(
    "docker",
    [
      ...baseArgs(opts.wt, "/home/agent"),
      ...authEnv(),
      ...mountArgs({ wt: opts.wt, readOnly: limits.readOnly, home, skillsDir: opts.skillsDir }),
      config.image,
      ...cli,
    ],
    { input: opts.prompt },
  );
  writeFileSync(join(opts.outDir, `${opts.label}.json`), res.stdout);
  if (res.stderr) writeFileSync(join(opts.outDir, `${opts.label}.stderr.log`), res.stderr);

  let parsed: CliJson | null = null;
  try {
    parsed = JSON.parse(res.stdout) as CliJson;
  } catch {
    parsed = null;
  }
  if (!parsed) {
    return {
      ok: false,
      structured: null,
      text: "",
      cost: 0,
      turns: 0,
      error: tail(res.stderr || res.stdout, 20),
    };
  }
  const structured = (parsed.structured_output ?? null) as T | null;
  const failed =
    parsed.is_error ||
    (parsed.subtype && parsed.subtype !== "success") ||
    (opts.schema && !structured);
  const text = parsed.result ?? "";
  writeFileSync(
    join(opts.outDir, `${opts.label}.md`),
    structured ? JSON.stringify(structured, null, 2) : text,
  );
  return {
    ok: !failed,
    structured,
    text,
    cost: parsed.total_cost_usd ?? 0,
    turns: parsed.num_turns ?? 0,
    error: failed ? `${parsed.subtype ?? "error"}: ${text.slice(0, 500)}` : null,
  };
}

/** One tiny run that prints the init event, to see which skills the container actually loads. */
export async function smokeTest(
  wt: string,
  outDir: string,
  skillsDir: string,
): Promise<{ ok: boolean; stream: string; error: string }> {
  const home = join(outDir, "homes", "smoke");
  mkdirSync(home, { recursive: true });
  const res = await run(
    "docker",
    [
      ...baseArgs(wt, "/home/agent"),
      ...authEnv(),
      ...mountArgs({ wt, readOnly: true, home, skillsDir }),
      config.image,
      "claude",
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--max-turns",
      "1",
      "--max-budget-usd",
      STAGES.smoke.usd.toFixed(2),
    ],
    { input: "Reply with the single word OK." },
  );
  writeFileSync(join(outDir, "smoke.jsonl"), res.stdout);
  return { ok: res.code === 0, stream: res.stdout, error: tail(res.stderr, 20) };
}
