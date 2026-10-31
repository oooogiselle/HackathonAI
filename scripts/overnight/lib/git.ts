// Git and GitHub steps. These run on the host only: the container has no push or gh credentials.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { config } from "./config";
import { sh, trySh } from "./proc";

const ATTRIBUTION = "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>";
// No emoji in the footer: CLAUDE.md says no emojis, and the guards would flag it.
const PR_FOOTER = "Generated with [Claude Code](https://claude.com/claude-code)";

/** `origin/<base>` when the remote has it (after a fetch), else the local branch. */
export function baseRef(): string {
  trySh("git", ["fetch", "--quiet", "origin", config.base], config.mainRoot);
  return trySh(
    "git",
    ["rev-parse", "--verify", "--quiet", `origin/${config.base}`],
    config.mainRoot,
  )
    ? `origin/${config.base}`
    : config.base;
}

export function localBranches(): Set<string> {
  const out = sh(
    "git",
    ["for-each-ref", "--format=%(refname:short)", "refs/heads"],
    config.mainRoot,
  );
  return new Set(out.split("\n").filter(Boolean));
}

/** The worktree for `agent/<slug>`: reused if it exists, else created from the base ref. */
export function ensureWorktree(
  slug: string,
  base: string,
): { path: string; branch: string; startSha: string } {
  const branch = `agent/${slug}`;
  const path = join(config.worktreesDir, `agent-${slug}`);
  mkdirSync(config.worktreesDir, { recursive: true });
  if (!existsSync(path)) {
    const exists = trySh(
      "git",
      ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`],
      config.mainRoot,
    );
    const args = exists
      ? ["worktree", "add", path, branch]
      : ["worktree", "add", "--no-track", "-b", branch, path, base];
    sh("git", args, config.mainRoot);
  }
  const startSha = sh("git", ["merge-base", base, "HEAD"], path);
  return { path, branch, startSha };
}

/** A detached worktree at the base ref, for the baseline gate and ideation. */
export function ensureBaseWorktree(base: string): string {
  const path = join(config.worktreesDir, "agent-base");
  mkdirSync(config.worktreesDir, { recursive: true });
  if (!existsSync(path)) sh("git", ["worktree", "add", "--detach", path, base], config.mainRoot);
  else sh("git", ["checkout", "--quiet", "--detach", base], path);
  return path;
}

/** Drops a worktree and its branch (only used when nothing was built on it). */
export function removeWorktree(wt: string, branch: string) {
  trySh("git", ["worktree", "remove", "--force", wt], config.mainRoot);
  trySh("git", ["branch", "-D", branch], config.mainRoot);
}

/** The worktree's admin folder under .git/worktrees (the container needs it writable). */
export function worktreeGitDir(wt: string): string {
  const gitFile = readFileSync(join(wt, ".git"), "utf8");
  const m = /^gitdir: (.+)$/m.exec(gitFile);
  return m ? m[1].trim() : join(config.commonDir, "worktrees", basename(wt));
}

export function stageAll(wt: string) {
  sh("git", ["add", "-A"], wt);
}

export function stagedDiff(wt: string, base: string): { diff: string; nameStatus: string } {
  return {
    diff: sh("git", ["diff", "--cached", base], wt),
    nameStatus: sh("git", ["diff", "--cached", "--name-status", base], wt),
  };
}

export function hasChanges(wt: string, sinceSha: string): boolean {
  stageAll(wt);
  return sh("git", ["diff", "--cached", "--name-only", sinceSha], wt) !== "";
}

/** One clean commit per task: squash everything since `startSha` (incl. checkpoints) into it. */
export function squashCommit(wt: string, startSha: string, subject: string, body: string) {
  stageAll(wt);
  sh("git", ["reset", "--soft", startSha], wt);
  sh(
    "git",
    ["commit", "--quiet", "--no-verify", "-m", subject, "-m", `${body}\n\n${ATTRIBUTION}`],
    wt,
  );
}

/** A temporary commit so a risky step (polish) can be rolled back. Squashed away later. */
export function checkpoint(wt: string, label: string): string {
  stageAll(wt);
  sh(
    "git",
    ["commit", "--quiet", "--no-verify", "--allow-empty", "-m", `overnight checkpoint: ${label}`],
    wt,
  );
  return sh("git", ["rev-parse", "HEAD"], wt);
}

export function rollback(wt: string, sha: string) {
  sh("git", ["reset", "--quiet", "--hard", sha], wt);
  sh("git", ["clean", "-fdq"], wt);
}

export function pushBranch(wt: string, branch: string) {
  sh("git", ["push", "--quiet", "--force-with-lease", "-u", "origin", branch], wt);
}

/** Opens a draft PR against the base, or returns the existing one's URL. */
export function openDraftPr(wt: string, branch: string, title: string, body: string): string {
  const existing = trySh("gh", ["pr", "view", branch, "--json", "url", "--jq", ".url"], wt);
  const fullBody = `${body}\n\n${PR_FOOTER}`;
  if (existing) {
    sh("gh", ["pr", "edit", branch, "--title", title, "--body", fullBody], wt);
    return existing;
  }
  return sh(
    "gh",
    [
      "pr",
      "create",
      "--draft",
      "--base",
      config.base,
      "--head",
      branch,
      "--title",
      title,
      "--body",
      fullBody,
    ],
    wt,
  );
}
