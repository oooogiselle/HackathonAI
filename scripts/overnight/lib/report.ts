// Per-task report.md (also the PR body) and the night's SUMMARY.md.

import type { Task } from "./tasks";

export type Review = {
  verdict: "pass" | "fix" | "blocked";
  done_when_met: boolean;
  summary: string;
  issues: { file: string; problem: string; fix: string }[];
  bad_tests: string[];
  suggestions: string[];
  next_prompt: string;
};

export type Analysis = {
  verdict: "approve" | "revise" | "reject";
  summary: string;
  rule_violations: string[];
  risks: string[];
  simpler_alternative: string;
  scope_creep: string[];
  missing_tests: string[];
  required_changes: string[];
};

export type TaskStatus = "pass" | "blocked" | "rejected" | "designed" | "skipped" | "error";

export type TaskState = {
  task: Task;
  status: TaskStatus;
  reason: string;
  attempts: number;
  cost: number;
  branch: string | null;
  worktree: string | null;
  prUrl: string | null;
  spec: string | null;
  design: string | null;
  analysis: Analysis | null;
  review: Review | null;
  gate: { ok: boolean; failedStep: string | null } | null;
  guardFailures: string[];
  guardWarnings: string[];
  breakSummary: string | null;
  nextPrompt: string;
  log: string[];
};

const list = (items: string[], empty = "None.") =>
  items.length ? items.map((i) => `- ${i}`).join("\n") : empty;
const details = (summary: string, body: string | null) =>
  body ? `<details><summary>${summary}</summary>\n\n${body}\n\n</details>` : "";

export function taskReport(s: TaskState, runId: string): string {
  const r = s.review;
  const a = s.analysis;
  const humanEyes = s.guardWarnings.length
    ? `\n\n**Needs human eyes:**\n${list(s.guardWarnings)}`
    : "";
  return [
    `## ${s.task.title}`,
    "",
    `**Status:** ${s.status}${s.reason ? `: ${s.reason}` : ""}  `,
    `**Source:** ${s.task.source} · **Attempts:** ${s.attempts} · **Cost:** $${s.cost.toFixed(2)} · **Run:** ${runId}`,
    humanEyes,
    "",
    "### Gate",
    s.gate
      ? s.gate.ok
        ? "lint, typecheck, unit tests and e2e passed (run in the container by the pipeline, not by the agent)."
        : `Failed at \`pnpm ${s.gate.failedStep}\`.`
      : "Not run.",
    s.guardFailures.length ? `\n**Guard failures:**\n${list(s.guardFailures)}` : "",
    "",
    "### Review",
    r
      ? `**${r.verdict}** (Done when met: ${r.done_when_met ? "yes" : "no"}). ${r.summary}`
      : "No review.",
    r && r.issues.length
      ? `\n**Issues:**\n${list(r.issues.map((i) => `\`${i.file}\`: ${i.problem} Fix: ${i.fix}`))}`
      : "",
    r && r.suggestions.length ? `\n**Suggestions (non-blocking):**\n${list(r.suggestions)}` : "",
    s.breakSummary ? `\n**Break-it:** ${s.breakSummary}` : "",
    "",
    "### Task",
    "```",
    s.task.block,
    "```",
    "",
    details("Spec (mini-PRD)", s.spec),
    details("Architecture design", s.design),
    details(
      `Design analysis: ${a?.verdict ?? "none"}`,
      a
        ? [
            a.summary,
            `\n**Rule violations:**\n${list(a.rule_violations)}`,
            `\n**Risks (pre-mortem):**\n${list(a.risks)}`,
            a.simpler_alternative ? `\n**Simpler alternative:** ${a.simpler_alternative}` : "",
            `\n**Required changes:**\n${list(a.required_changes)}`,
          ].join("\n")
        : null,
    ),
    "",
    "### Run it again",
    "",
    s.branch
      ? `\`pnpm overnight --resume ${s.task.slug}\` runs the prompt below in \`${s.worktree}\`.`
      : "",
    "",
    "```",
    s.nextPrompt || "(no prompt)",
    "```",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export type IdeaRow = {
  title: string;
  verdict: string;
  score: number;
  risk: string[];
  action: string;
  reasons: string[];
};

export function summaryReport(opts: {
  runId: string;
  started: Date;
  finished: Date;
  spent: number;
  baseline: string;
  skills: { copied: string[]; missing: string[]; loaded: string[] | null };
  tasks: TaskState[];
  ideas: IdeaRow[];
  existing: IdeaRow[];
  skipped: { title: string; reason: string }[];
  notesPr: string | null;
  stopReason: string;
}): string {
  const rows = opts.tasks.map(
    (s) =>
      `| ${s.task.title} | ${s.task.source} | **${s.status}** | ${s.attempts} | $${s.cost.toFixed(2)} | ${s.prUrl ?? "-"} | \`pnpm overnight --resume ${s.task.slug}\` |`,
  );
  const ideaRows = (rows: IdeaRow[]) =>
    rows.map(
      (i) =>
        `| ${i.title} | ${i.verdict} | ${i.score} | ${i.risk.join(", ") || "-"} | ${i.action} | ${i.reasons.join("; ")} |`,
    );
  return [
    `# Overnight run ${opts.runId}`,
    "",
    `${opts.started.toLocaleString()} to ${opts.finished.toLocaleString()} · spent $${opts.spent.toFixed(2)} · stopped: ${opts.stopReason}`,
    "",
    `**Baseline gate on the base branch:** ${opts.baseline}`,
    opts.notesPr ? `**Proposed tasks and notes PR:** ${opts.notesPr}` : "",
    "",
    "## Tasks",
    "",
    "| Task | Source | Status | Attempts | Cost | PR | Run again |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "Each task's full report (spec, design, analysis, review, next prompt) is in `.overnight/" +
      opts.runId +
      "/<slug>/report.md`.",
    "",
    "## Ideas from tonight",
    "",
    "| Idea | Critic | Score | Risk | Action | Reasons |",
    "| --- | --- | --- | --- | --- | --- |",
    ...ideaRows(opts.ideas),
    "",
    "## Existing tasks, as the critic saw them",
    "",
    "| Task | Critic | Score | Risk | Action | Reasons |",
    "| --- | --- | --- | --- | --- | --- |",
    ...ideaRows(opts.existing),
    "",
    "## Not picked",
    "",
    list(opts.skipped.map((s) => `${s.title}: ${s.reason}`)),
    "",
    "## Skills",
    "",
    `Copied into the container: ${opts.skills.copied.join(", ") || "none"}.`,
    `Not found on the host: ${opts.skills.missing.join(", ") || "none"}.`,
    opts.skills.loaded
      ? `Loaded by the CLI (smoke test): ${opts.skills.loaded.join(", ")}.`
      : "The smoke test couldn't list loaded skills.",
  ].join("\n");
}
