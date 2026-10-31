// Deterministic checks on a task's diff against the base branch. They catch the ways an agent
// "passes" without doing the work: skipped or deleted tests, env edits, rewritten migrations.

import { PROTECTED_PATHS } from "./rules";

export type FileChange = { status: string; path: string };
export type GuardResult = { failures: string[]; warnings: string[] };

/** Parses `git diff --name-status` output (renames count as the new path). */
export function parseNameStatus(text: string): FileChange[] {
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      return { status: parts[0][0], path: parts[parts.length - 1] };
    });
}

/** Added and removed lines per file from a unified diff. */
export function parseDiff(diff: string): Map<string, { added: string[]; removed: string[] }> {
  const files = new Map<string, { added: string[]; removed: string[] }>();
  let current: { added: string[]; removed: string[] } | null = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const m = / b\/(.+)$/.exec(line);
      current = { added: [], removed: [] };
      files.set(m ? m[1] : line, current);
    } else if (!current || line.startsWith("+++ ") || line.startsWith("--- ")) {
      continue;
    } else if (line.startsWith("+")) {
      current.added.push(line.slice(1));
    } else if (line.startsWith("-")) {
      current.removed.push(line.slice(1));
    }
  }
  return files;
}

const isTestFile = (p: string) => /\.test\.tsx?$/.test(p) || /^e2e\/.*\.spec\.ts$/.test(p);
const SKIP_OR_ONLY =
  /\b(test|it|describe)\.(skip|only|fixme|todo)\b|\b(xit|xdescribe|fit|fdescribe)\(/;
const TEST_DECL = /^\s*(test|it)(\.each\([^)]*\))?\(\s*["'`]/;
const EMOJI = /\p{Extended_Pictographic}/u;
const IGNORED_FOR_SIZE = /(^|\/)pnpm-lock\.yaml$|^drizzle\/meta\//;

const countEmoji = (lines: string[]) =>
  lines.reduce((n, l) => n + (l.match(new RegExp(EMOJI.source, "gu"))?.length ?? 0), 0);

export function checkGuards(
  diff: string,
  changes: FileChange[],
  maxDiffLines: number,
): GuardResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const files = parseDiff(diff);

  for (const c of changes) {
    if (c.status === "D" && isTestFile(c.path)) failures.push(`deleted test file ${c.path}`);
    if (/(^|\/)\.env/.test(c.path)) failures.push(`changed env file ${c.path}`);
    if (c.path.startsWith("drizzle/") && !c.path.startsWith("drizzle/meta/") && c.status !== "A") {
      failures.push(`changed an existing migration ${c.path} (add a new one instead)`);
    }
    const hit = PROTECTED_PATHS.find((p) => c.path === p || c.path.startsWith(p));
    if (hit) warnings.push(`touches protected path ${c.path}: needs human eyes`);
  }

  let addedTests = 0;
  let removedTests = 0;
  let size = 0;
  for (const [path, { added, removed }] of files) {
    if (!IGNORED_FOR_SIZE.test(path)) size += added.length;
    if (isTestFile(path)) {
      if (added.some((l) => SKIP_OR_ONLY.test(l)))
        failures.push(`added .skip/.only/.fixme/.todo in ${path}`);
      addedTests += added.filter((l) => TEST_DECL.test(l)).length;
      removedTests += removed.filter((l) => TEST_DECL.test(l)).length;
    }
    // Count emojis, so editing a line that already had one (like the old "Covered" check) doesn't trip.
    if (countEmoji(added) > countEmoji(removed)) {
      const line = added.find((l) => EMOJI.test(l)) ?? "";
      failures.push(`emoji added in ${path} (CLAUDE.md: no emojis): ${line.trim().slice(0, 80)}`);
    }
  }
  if (removedTests > addedTests) {
    failures.push(
      `fewer tests than the base (${removedTests} test declarations removed, ${addedTests} added)`,
    );
  }
  if (size > maxDiffLines) {
    failures.push(`diff adds ${size} lines (cap ${maxDiffLines}); split the task or cut scope`);
  }
  return { failures, warnings: [...new Set(warnings)] };
}
