// Overnight agent pipeline. See scripts/overnight/README.md.
//
//   pnpm overnight                    ideate, critique, then work the queue until STOP_AT or the budget
//   pnpm overnight --dry-run          show the queue and skip reasons; no agents, no Docker
//   pnpm overnight --ideate-only      ideas + critique + the notes PR, no code
//   pnpm overnight --task <slug>      one task from tasks.md (design, build, test, review)
//   pnpm overnight --task <slug> --design-only    spec + architecture + analysis only
//   pnpm overnight --resume <slug>    continue a blocked task with its saved next prompt
//   Flags: --once, --no-ideate, --no-push, --polish, --skip-baseline, --no-smoke
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { config, STAGES, type Stage } from "./lib/config";
import { installDeps, runAgent, runGate, smokeTest, type GateResult } from "./lib/docker";
import {
  baseRef,
  checkpoint,
  ensureBaseWorktree,
  ensureWorktree,
  hasChanges,
  localBranches,
  openDraftPr,
  pushBranch,
  removeWorktree,
  rollback,
  squashCommit,
  stageAll,
  stagedDiff,
} from "./lib/git";
import { checkGuards, parseNameStatus } from "./lib/guards";
import { sh, tail, trySh } from "./lib/proc";
import {
  summaryReport,
  taskReport,
  type Analysis,
  type IdeaRow,
  type Review,
  type TaskState,
} from "./lib/report";
import { deadline, RISKY_TAGS } from "./lib/rules";
import { parseInitSkills, prepareSkills, skillsFor, skillsPrompt } from "./lib/skills";
import {
  addNote,
  appendProposed,
  checkOff,
  parseTasks,
  skipReason,
  slugify,
  type ProposedTask,
  type Task,
} from "./lib/tasks";

const { values: flags } = parseArgs({
  options: {
    once: { type: "boolean" },
    task: { type: "string" },
    resume: { type: "string" },
    "no-ideate": { type: "boolean" },
    "ideate-only": { type: "boolean" },
    "design-only": { type: "boolean" },
    "dry-run": { type: "boolean" },
    "no-push": { type: "boolean" },
    polish: { type: "boolean" },
    "skip-baseline": { type: "boolean" },
    "no-smoke": { type: "boolean" },
  },
});
const push = !flags["no-push"];

// ---------- run setup ----------

const started = new Date();
const runId = started.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
const runDir = join(config.overnightDir, runId);
const skillsDir = join(runDir, "claude-home");
const stopAt = deadline(started, config.stopAt);
let spent = 0;
let stopReason = "queue empty";

function log(msg: string) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(line);
  if (existsSync(runDir)) appendFileSync(join(runDir, "run.log"), `${line}\n`);
}

const prompt = (name: string) =>
  readFileSync(join(config.pipelineDir, "prompts", `${name}.md`), "utf8").trim();
const schema = (name: string) =>
  JSON.parse(readFileSync(join(config.pipelineDir, "schemas", `${name}.json`), "utf8")) as object;
const compose = (stage: string, sections: (string | null | undefined | false)[]) =>
  [prompt(stage), ...sections].filter(Boolean).join("\n\n");
const fence = (text: string) => `\`\`\`\n${text}\n\`\`\``;

class BudgetError extends Error {}

const base = baseRef();
const tasksMd = sh("git", ["show", `${base}:tasks.md`], config.mainRoot);
const allTasks = parseTasks(tasksMd);
const branches = localBranches();

// ---------- dry run ----------

if (flags["dry-run"]) {
  console.log(
    `Base: ${base}. Stop at ${stopAt.toLocaleString()}. Night budget $${config.maxCostUsd}.\n`,
  );
  for (const t of allTasks) {
    const why = skipReason(t, branches);
    console.log(`${why ? "skip" : "PICK"}  ${t.slug.padEnd(42)} ${why ?? t.title}`);
  }
  process.exit(0);
}

// ---------- preflight ----------

function preflight() {
  const problems: string[] = [];
  if (!trySh("docker", ["info", "--format", "{{.ServerVersion}}"]))
    problems.push("Docker isn't running.");
  else if (!trySh("docker", ["image", "inspect", config.image]))
    problems.push(`No image ${config.image}: run \`pnpm overnight:image\`.`);
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.OVERNIGHT_ANTHROPIC_API_KEY) {
    problems.push(
      "Set CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`) or OVERNIGHT_ANTHROPIC_API_KEY in the shell.",
    );
  }
  if (push && !trySh("gh", ["auth", "status"]))
    problems.push("`gh auth status` failed (or pass --no-push).");
  if (problems.length) {
    console.error(`Preflight failed:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
}

preflight();
mkdirSync(runDir, { recursive: true });
log(
  `Run ${runId}: base ${base}, stop at ${stopAt.toLocaleString()}, budget $${config.maxCostUsd}, push ${push}`,
);

const skills = prepareSkills(join(homedir(), ".claude"), skillsDir);
log(`Skills copied: ${skills.copied.join(", ")}. Missing: ${skills.missing.join(", ") || "none"}`);

const baseWt = ensureBaseWorktree(base);
if (!(await installDeps(baseWt, join(runDir, "base-install.log")))) {
  log("pnpm install failed in the base worktree; see base-install.log");
  process.exit(1);
}

let loadedSkills: Set<string> | null = null;
if (!flags["no-smoke"]) {
  const smoke = await smokeTest(baseWt, runDir, skillsDir);
  if (!smoke.ok) {
    log(`Smoke test failed (is the token valid?): ${smoke.error}`);
    process.exit(1);
  }
  loadedSkills = parseInitSkills(smoke.stream);
  log(
    `Smoke test ok. Skills the CLI loaded: ${loadedSkills ? [...loadedSkills].join(", ") : "unknown"}`,
  );
}

// ---------- agents with budget ----------

/** Runs one stage, charging the task (if any) and the night. Throws BudgetError when money runs out. */
async function agent<T>(
  stage: Stage,
  label: string,
  wt: string,
  text: string,
  outDir: string,
  schemaName?: string,
  state?: TaskState,
) {
  const taskLeft = state ? config.taskBudgetUsd - state.cost : Infinity;
  const cap = Math.min(STAGES[stage].usd, taskLeft, config.maxCostUsd - spent);
  if (cap < 0.25) throw new BudgetError(`budget left $${cap.toFixed(2)}`);
  log(`  ${label} (cap $${cap.toFixed(2)})`);
  const res = await runAgent<T>({
    stage,
    label,
    wt,
    prompt: text,
    systemPrompt: prompt("_common"),
    schema: schemaName ? schema(schemaName) : undefined,
    budgetUsd: cap,
    outDir,
    skillsDir,
  });
  spent += res.cost;
  if (state) {
    state.cost += res.cost;
    state.log.push(
      `${label}: ${res.ok ? "ok" : `failed (${res.error})`}, $${res.cost.toFixed(2)}, ${res.turns} turns`,
    );
  }
  log(
    `  ${label}: ${res.ok ? "ok" : `FAILED ${res.error}`} ($${res.cost.toFixed(2)}, night $${spent.toFixed(2)})`,
  );
  return res;
}

// ---------- baseline ----------

let baseline = "skipped";
let baselineGate: GateResult | null = null;
const queue: Task[] = [];
if (!flags["skip-baseline"] && !flags.resume) {
  log("Baseline gate on the base branch");
  baselineGate = await runGate(baseWt, join(runDir, "baseline-gate.log"));
  baseline = baselineGate.ok
    ? "green"
    : `red at pnpm ${baselineGate.failedStep} (see baseline-gate.log)`;
  log(`Baseline: ${baseline}`);
  if (!baselineGate.ok) {
    const title = `Fix the failing ${baselineGate.failedStep} gate step on ${config.base}`;
    queue.push({
      title,
      slug: slugify(`fix-base-${runId}`),
      section: "overnight",
      checked: false,
      source: "idea",
      block: [
        `- [ ] ${title}`,
        `      Done when: pnpm lint, pnpm typecheck, pnpm test and pnpm test:e2e all pass on a clean checkout of ${config.base}, without skipping or weakening any test.`,
        "      Baseline gate output (tail):",
        tail(baselineGate.logTail, 60)
          .split("\n")
          .map((l) => `      ${l}`)
          .join("\n"),
      ].join("\n"),
    });
  }
}

// ---------- ideate + critique ----------

type Idea = {
  title: string;
  why: string;
  prd_line: string;
  done_when: string;
  files: string[];
  size: "S" | "M" | "L";
  risk_tags: string[];
};
type Critique = {
  title: string;
  kind: "idea" | "existing";
  verdict: "accept" | "revise" | "reject" | "needs-human" | "stale";
  score: number;
  reasons: string[];
  done_when: string;
  risk_tags: string[];
};

const ideaRows: IdeaRow[] = [];
const existingRows: IdeaRow[] = [];
const proposed: ProposedTask[] = [];
const notes: { title: string; note: string }[] = [];
const skipped: { title: string; reason: string }[] = [];

let existing = allTasks.filter((t) => {
  const why = skipReason(t, branches);
  if (why && !t.checked) skipped.push({ title: t.title, reason: why });
  return !why;
});

const ideate = !flags["no-ideate"] && !flags.task && !flags.resume;
if (ideate) {
  const ideaDir = join(runDir, "_ideas");
  mkdirSync(ideaDir, { recursive: true });
  try {
    const ideasRes = await agent<{ ideas: Idea[] }>(
      "ideate",
      "ideate",
      baseWt,
      compose("ideate", [
        `## Limits\n\nReturn at most ${config.maxIdeas} ideas.`,
        `## Baseline gate on ${base}\n\n${baselineGate ? (baselineGate.ok ? "Green." : `Red at pnpm ${baselineGate.failedStep}:\n${fence(tail(baselineGate.logTail, 60))}`) : "Not run."}`,
        skillsPrompt(skillsFor("ideate"), loadedSkills),
      ]),
      ideaDir,
      "ideas",
    );
    const ideas = ideasRes.structured?.ideas ?? [];
    const items = [
      ...ideas.map(
        (i) =>
          `### idea: ${i.title}\nWhy: ${i.why}\nServes: ${i.prd_line}\nDone when: ${i.done_when}\nSize: ${i.size}. Risk: ${i.risk_tags.join(", ") || "none"}. Files: ${i.files.join(", ")}`,
      ),
      ...existing.map((t) => `### existing: ${t.title}\n${fence(t.block)}`),
    ];
    const critRes = await agent<{ items: Critique[] }>(
      "critique",
      "critique",
      baseWt,
      compose("critique", [
        `## Items\n\n${items.join("\n\n")}`,
        skillsPrompt(skillsFor("critique"), loadedSkills),
      ]),
      ideaDir,
      "critique",
    );
    const verdicts = critRes.structured?.items ?? [];
    const verdictFor = (title: string) =>
      verdicts.find((v) => v.title === title || slugify(v.title) === slugify(title));

    // Existing tasks: drop stale / rejected / human ones (with a note in tasks.md), sharpen the rest.
    existing = existing.flatMap((t) => {
      const v = verdictFor(t.title);
      if (!v) return [t];
      existingRows.push({
        title: t.title,
        verdict: v.verdict,
        score: v.score,
        risk: v.risk_tags,
        action: "",
        reasons: v.reasons,
      });
      const row = existingRows[existingRows.length - 1];
      if (v.verdict === "stale" || v.verdict === "reject" || v.verdict === "needs-human") {
        row.action = "skipped, note added";
        notes.push({
          title: t.title,
          note: `SKIP: overnight critic ${runId} says ${v.verdict}: ${v.reasons.join("; ")}`,
        });
        skipped.push({ title: t.title, reason: `critic: ${v.verdict}` });
        return [];
      }
      row.action = "queued";
      const sharpened =
        v.done_when && v.done_when.trim() !== ""
          ? `\n      Critic's sharpened Done when (${runId}): ${v.done_when.trim()}`
          : "";
      return [{ ...t, block: `${t.block}${sharpened}` }];
    });

    // Ideas: auto-run the safe, strong ones; propose the rest for a human.
    let autoRun = 0;
    for (const idea of ideas) {
      const v = verdictFor(idea.title);
      const risk = [...new Set([...idea.risk_tags, ...(v?.risk_tags ?? [])])];
      const row: IdeaRow = {
        title: idea.title,
        verdict: v?.verdict ?? "unreviewed",
        score: v?.score ?? 0,
        risk,
        action: "",
        reasons: v?.reasons ?? [],
      };
      ideaRows.push(row);
      if (!v || v.verdict === "reject" || v.verdict === "stale") {
        row.action = "dropped";
        continue;
      }
      const doneWhen = v.done_when?.trim() || idea.done_when;
      const risky = risk.filter((r) => RISKY_TAGS.includes(r));
      const slug = slugify(idea.title);
      const safe =
        (v.verdict === "accept" || v.verdict === "revise") &&
        v.score >= config.minIdeaScore &&
        idea.size !== "L" &&
        risky.length === 0 &&
        !branches.has(`agent/${slug}`);
      if (safe && autoRun < config.maxIdeaTasks) {
        autoRun++;
        row.action = "built tonight";
        queue.push({
          title: idea.title,
          slug,
          section: "overnight ideas",
          checked: false,
          source: "idea",
          block: `- [ ] ${idea.title}\n      Why: ${idea.why}\n      Serves: ${idea.prd_line}\n      Done when: ${doneWhen}`,
        });
      } else {
        row.action = "proposed for a human";
        const why = risky.length
          ? `risk: ${risky.join(", ")}`
          : idea.size === "L"
            ? "size L"
            : safe
              ? "over tonight's idea cap"
              : `critic ${v.verdict}, score ${v.score}`;
        proposed.push({
          title: idea.title,
          doneWhen,
          note: `Why: ${idea.why} Proposed by overnight ${runId} (${why}). Critic: ${v.reasons.join("; ")}`,
        });
      }
    }
    log(
      `Ideas: ${ideas.length}, built tonight: ${autoRun}, proposed: ${proposed.length}. Existing queued: ${existing.length}`,
    );
  } catch (e) {
    if (!(e instanceof BudgetError)) throw e;
    stopReason = "budget";
  }
}

// ---------- pick the queue ----------

type Resume = { prompt: string; spec: string | null; design: string | null; task: Task | null };

/** The newest saved state for a slug from earlier runs. */
function findResume(slug: string): Resume | null {
  if (!existsSync(config.overnightDir)) return null;
  for (const run of readdirSync(config.overnightDir).sort().reverse()) {
    const dir = join(config.overnightDir, run, slug);
    const file = join(dir, "next-prompt.md");
    if (!existsSync(file)) continue;
    const read = (f: string) =>
      existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : null;
    const taskJson = read("task.json");
    return {
      prompt: readFileSync(file, "utf8"),
      spec: read("spec.md"),
      design: read("design.md"),
      task: taskJson ? (JSON.parse(taskJson) as Task) : null,
    };
  }
  return null;
}

let resume: Resume | null = null;
if (flags.resume) {
  resume = findResume(flags.resume);
  const task = resume?.task ?? allTasks.find((t) => t.slug === flags.resume);
  if (!resume || !task) {
    console.error(
      `Nothing to resume for ${flags.resume} (no next-prompt.md under .overnight/*/${flags.resume}/).`,
    );
    process.exit(1);
  }
  queue.splice(0, queue.length, task);
} else if (flags.task) {
  const task = allTasks.find((t) => t.slug === flags.task);
  if (!task) {
    console.error(`No task with slug ${flags.task}. Run with --dry-run to list slugs.`);
    process.exit(1);
  }
  queue.splice(0, queue.length, task);
} else {
  // Fix-the-base first, then the existing queue in tasks.md order, then tonight's ideas.
  const fixBase = queue.filter((t) => t.slug.startsWith("fix-base"));
  const ideasQueued = queue.filter((t) => !t.slug.startsWith("fix-base"));
  queue.splice(0, queue.length, ...fixBase, ...existing, ...ideasQueued);
}

// ---------- one task ----------

async function runTask(task: Task, resumeFrom: Resume | null): Promise<TaskState> {
  const dir = join(runDir, task.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "task.json"), JSON.stringify(task, null, 2));
  const s: TaskState = {
    task,
    status: "error",
    reason: "",
    attempts: 0,
    cost: 0,
    branch: null,
    worktree: null,
    prUrl: null,
    spec: resumeFrom?.spec ?? null,
    design: resumeFrom?.design ?? null,
    analysis: null,
    review: null,
    gate: null,
    guardFailures: [],
    guardWarnings: [],
    breakSummary: null,
    nextPrompt: "",
    log: [],
  };
  log(`Task: ${task.title} (${task.slug})`);

  const taskSection = `## Task\n\n${fence(task.block)}\n\nBase branch: \`${base}\`. Branch: \`agent/${task.slug}\`.`;
  const specSection = () => (s.spec ? `## Approved spec\n\n${s.spec}` : null);
  const designSection = () => (s.design ? `## Approved design\n\n${s.design}` : null);
  const save = (file: string, text: string) => writeFileSync(join(dir, file), text);
  const pathsInTask = [...task.block.matchAll(/`((?:src|e2e|drizzle|docs)\/[^`\s]+)`/g)].map(
    (m) => m[1],
  );
  let designFiles: string[] = pathsInTask;
  let startSha = "";
  let wt = "";

  const fallbackPrompt = (failure: string) =>
    [
      "Continue the task below in this worktree. A previous overnight attempt stopped here.",
      taskSection,
      specSection(),
      designSection(),
      `## Where it stopped\n\n${failure}`,
      "Run pnpm lint, pnpm typecheck, pnpm test and pnpm test:e2e before you finish. Don't commit.",
    ]
      .filter(Boolean)
      .join("\n\n");

  const publish = (title: string) => {
    const report = taskReport(s, runId);
    save("report.md", report);
    if (!push || !s.branch) return;
    try {
      pushBranch(wt, s.branch);
      s.prUrl = openDraftPr(wt, s.branch, title, report);
      log(`  PR: ${s.prUrl}`);
    } catch (e) {
      s.log.push(`push/PR failed: ${String(e)}`);
      log(`  push/PR failed: ${String(e)}`);
    }
  };

  const finish = (status: TaskState["status"], reason: string) => {
    s.status = status;
    s.reason = reason;
    if (!s.nextPrompt) s.nextPrompt = fallbackPrompt(reason);
    save("next-prompt.md", s.nextPrompt);
    if (status === "pass" && !hasChanges(wt, startSha)) {
      // Nothing to ship (the task was already done): no empty PR.
      s.reason = "review passed with no changes; the task looks already done";
      save("report.md", taskReport(s, runId));
      if (task.source === "tasks.md")
        notes.push({ title: task.title, note: `SKIP: overnight ${runId}: ${s.reason}` });
    } else if (status === "pass") {
      if (task.source === "tasks.md") {
        const file = join(wt, "tasks.md");
        writeFileSync(file, checkOff(readFileSync(file, "utf8"), task.title));
      }
      squashCommit(
        wt,
        startSha,
        task.title,
        `${s.review?.summary ?? ""}\n\nBuilt by the overnight pipeline (run ${runId}): spec, design, analysis, implement, gate, break-it, review.`,
      );
      publish(task.title);
    } else if (status === "blocked" && wt && hasChanges(wt, startSha)) {
      squashCommit(
        wt,
        startSha,
        `WIP (blocked): ${task.title}`,
        `Stopped: ${reason}\n\nOvernight pipeline run ${runId}. See the PR body for the next prompt.`,
      );
      publish(`[blocked] ${task.title}`);
    } else {
      save("report.md", taskReport(s, runId));
      if (
        wt &&
        (status === "rejected" || status === "designed" || status === "blocked") &&
        s.branch
      ) {
        // Nothing was built: drop the empty branch so the slug can be picked again after a human edit.
        removeWorktree(wt, s.branch);
        s.branch = null;
      }
    }
    if (task.source === "tasks.md" && (status === "blocked" || status === "rejected")) {
      notes.push({
        title: task.title,
        note: `BLOCKED: overnight ${runId} (${status}): ${reason.slice(0, 300)}`,
      });
    }
    save("state.json", JSON.stringify(s, null, 2));
    log(`  => ${status}${reason ? `: ${reason}` : ""} ($${s.cost.toFixed(2)})`);
    return s;
  };

  /** Gate + guards, run by the pipeline itself. */
  const check = async (label: string) => {
    const gate = await runGate(wt, join(dir, `${label}.gate.log`));
    stageAll(wt);
    const { diff, nameStatus } = stagedDiff(wt, base);
    save(`${label}.diff`, diff);
    const changes = parseNameStatus(nameStatus);
    const guards = checkGuards(diff, changes, config.maxDiffLines);
    s.gate = { ok: gate.ok, failedStep: gate.failedStep };
    s.guardFailures = guards.failures;
    s.guardWarnings = guards.warnings;
    const ok = gate.ok && guards.failures.length === 0;
    log(
      `  ${label}: gate ${gate.ok ? "green" : `red at ${gate.failedStep}`}, guards ${guards.failures.length ? guards.failures.join("; ") : "ok"}`,
    );
    const section = [
      `## Gate and guards (run by the pipeline)`,
      gate.ok
        ? "Gate: lint, typecheck, unit tests and e2e all passed."
        : `Gate failed at \`pnpm ${gate.failedStep}\`. Output (tail):\n${fence(tail(gate.logTail, 80))}`,
      guards.failures.length
        ? `Guard failures:\n${guards.failures.map((f) => `- ${f}`).join("\n")}`
        : "Guards: no failures.",
      guards.warnings.length ? `Warnings:\n${guards.warnings.map((f) => `- ${f}`).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    return { ok, section, paths: changes.map((c) => c.path) };
  };

  try {
    const w = ensureWorktree(task.slug, base);
    wt = w.path;
    startSha = w.startSha;
    s.branch = w.branch;
    s.worktree = wt;
    if (!(await installDeps(wt, join(dir, "install.log"))))
      return finish("error", "pnpm install failed (install.log)");

    let work: {
      summary: string;
      verified: string[];
      deviations: string[];
      blocked_reason: string;
    } | null;
    if (!resumeFrom) {
      // ----- design phase: nothing gets built until the analysis approves -----
      let feedback: string | null = null;
      for (let round = 1; ; round++) {
        const spec = await agent<{
          markdown: string;
          acceptance_criteria: string[];
          open_questions: string[];
          blocked_reason: string;
        }>(
          "spec",
          `spec-${round}`,
          wt,
          compose("spec", [taskSection, feedback, skillsPrompt(skillsFor("spec"), loadedSkills)]),
          dir,
          "spec",
          s,
        );
        if (!spec.structured) return finish("error", `spec stage failed: ${spec.error}`);
        if (spec.structured.blocked_reason)
          return finish("blocked", spec.structured.blocked_reason);
        s.spec = spec.structured.markdown;
        save("spec.md", s.spec);

        const design = await agent<{
          markdown: string;
          files: string[];
          test_plan: { criterion: string; test: string; kind: string }[];
        }>(
          "architecture",
          `architecture-${round}`,
          wt,
          compose("architecture", [
            taskSection,
            specSection(),
            feedback,
            skillsPrompt(skillsFor("architecture", designFiles), loadedSkills),
          ]),
          dir,
          "design",
          s,
        );
        if (!design.structured)
          return finish("error", `architecture stage failed: ${design.error}`);
        s.design = design.structured.markdown;
        designFiles = design.structured.files;
        save("design.md", s.design);

        const analysis = await agent<Analysis>(
          "analysis",
          `analysis-${round}`,
          wt,
          compose("analysis", [
            taskSection,
            specSection(),
            designSection(),
            skillsPrompt(skillsFor("analysis"), loadedSkills),
          ]),
          dir,
          "analysis",
          s,
        );
        if (!analysis.structured)
          return finish("error", `analysis stage failed: ${analysis.error}`);
        s.analysis = analysis.structured;
        save("analysis.json", JSON.stringify(s.analysis, null, 2));
        if (s.analysis.verdict === "approve") break;
        if (s.analysis.verdict === "reject") {
          s.nextPrompt = `The design analysis rejected this task: ${s.analysis.summary}\n\nIf it's still wanted, rewrite the task in tasks.md to address:\n${[...s.analysis.rule_violations, ...s.analysis.required_changes].map((c) => `- ${c}`).join("\n")}`;
          return finish("rejected", s.analysis.summary);
        }
        if (round >= config.maxDesignRounds) {
          return finish(
            "blocked",
            `design not approved after ${round} rounds: ${s.analysis.required_changes.join("; ")}`,
          );
        }
        feedback = `## The analysis asked for a revision. Address every required change:\n\n${[...s.analysis.rule_violations, ...s.analysis.required_changes, ...s.analysis.missing_tests].map((c) => `- ${c}`).join("\n")}${s.analysis.simpler_alternative ? `\n\nSimpler alternative to consider: ${s.analysis.simpler_alternative}` : ""}`;
      }
      if (flags["design-only"]) {
        s.nextPrompt = `Implement the approved design below.\n\n${taskSection}\n\n${specSection()}\n\n${designSection()}`;
        return finish("designed", "design approved; --design-only, nothing built");
      }

      // ----- build -----
      const impl = await agent<NonNullable<typeof work>>(
        "implement",
        "implement",
        wt,
        compose("implement", [
          taskSection,
          specSection(),
          designSection(),
          skillsPrompt(skillsFor("implement", designFiles), loadedSkills),
        ]),
        dir,
        "work",
        s,
      );
      work = impl.structured;
    } else {
      const res = await agent<NonNullable<typeof work>>(
        "fix",
        "fix-resume",
        wt,
        compose("fix", [
          taskSection,
          specSection(),
          designSection(),
          `## What failed\n\n${resumeFrom.prompt}`,
          skillsPrompt(skillsFor("fix"), loadedSkills),
        ]),
        dir,
        "work",
        s,
      );
      work = res.structured;
    }
    if (work?.blocked_reason) return finish("blocked", work.blocked_reason);

    // ----- test, break, review, fix -----
    let broke = false;
    let badTests: string[] = [];
    for (let attempt = 1; ; attempt++) {
      s.attempts = attempt;
      let result = await check(`attempt-${attempt}`);
      let justBroke = false;
      if (result.ok && !broke) {
        const br = await agent<{
          summary: string;
          tried: { scenario: string; test: string; result: string }[];
          found_bugs: boolean;
        }>(
          "break",
          `break-${attempt}`,
          wt,
          compose("break", [
            taskSection,
            specSection(),
            skillsPrompt(skillsFor("break"), loadedSkills),
          ]),
          dir,
          "break",
          s,
        );
        broke = true;
        justBroke = true;
        s.breakSummary = br.structured
          ? `${br.structured.summary} (${br.structured.tried.length} scenarios, ${br.structured.tried.filter((t) => t.result === "fail").length} failing${br.structured.found_bugs ? ", found bugs" : ""})`
          : `break-it stage failed: ${br.error}`;
        result = await check(`attempt-${attempt}-after-break`);
      }

      let failure: string;
      if (result.ok || justBroke) {
        const rev = await agent<Review>(
          "review",
          `review-${attempt}`,
          wt,
          compose("review", [
            taskSection,
            specSection(),
            designSection(),
            result.section,
            work
              ? `## The implementer's summary (don't trust it; check it)\n\n${work.summary}\nVerified: ${work.verified.join("; ")}\nDeviations: ${work.deviations.join("; ") || "none"}`
              : null,
            s.breakSummary ? `## Break-it\n\n${s.breakSummary}` : null,
            skillsPrompt(skillsFor("review", result.paths), loadedSkills),
          ]),
          dir,
          "review",
          s,
        );
        if (rev.structured) {
          s.review = rev.structured;
          s.nextPrompt = rev.structured.next_prompt;
          save("review.json", JSON.stringify(rev.structured, null, 2));
          badTests = rev.structured.bad_tests;
          if (rev.structured.verdict === "pass" && rev.structured.done_when_met && result.ok) {
            if (flags.polish) {
              const sha = checkpoint(wt, "before polish");
              await agent(
                "polish",
                "polish",
                wt,
                compose("polish", [taskSection, skillsPrompt(skillsFor("polish"), loadedSkills)]),
                dir,
                undefined,
                s,
              );
              const after = await check("after-polish");
              if (!after.ok) {
                log("  polish broke the gate; rolled back");
                rollback(wt, sha);
              }
            }
            return finish("pass", "");
          }
          if (rev.structured.verdict === "blocked")
            return finish("blocked", rev.structured.summary);
        }
        failure = [
          result.ok ? "" : result.section,
          rev.structured
            ? `## Review issues\n\n${rev.structured.issues.map((i) => `- \`${i.file}\`: ${i.problem}\n  Fix: ${i.fix}`).join("\n") || rev.structured.summary}`
            : `Review stage failed: ${rev.error}`,
          badTests.length
            ? `## Break-it tests the reviewer says are wrong (you may fix or delete these)\n\n${badTests.map((t) => `- ${t}`).join("\n")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n");
      } else {
        failure = result.section;
      }

      if (attempt >= config.maxAttempts)
        return finish(
          "blocked",
          `out of attempts (${attempt}); last failure is in the next prompt`,
        );
      const fix = await agent<NonNullable<typeof work>>(
        "fix",
        `fix-${attempt}`,
        wt,
        compose("fix", [
          taskSection,
          specSection(),
          designSection(),
          `## What failed\n\n${failure}`,
          skillsPrompt(skillsFor("fix", designFiles), loadedSkills),
        ]),
        dir,
        "work",
        s,
      );
      if (fix.structured) work = fix.structured;
      if (fix.structured?.blocked_reason) return finish("blocked", fix.structured.blocked_reason);
    }
  } catch (e) {
    if (e instanceof BudgetError) return finish("blocked", `budget: ${e.message}`);
    s.log.push(String(e));
    return finish("error", String(e).slice(0, 300));
  }
}

// ---------- the night ----------

const states: TaskState[] = [];
if (!flags["ideate-only"]) {
  for (const task of queue) {
    if (new Date() >= stopAt) {
      stopReason = `STOP_AT ${config.stopAt}`;
      break;
    }
    if (config.maxCostUsd - spent < 1) {
      stopReason = "night budget";
      break;
    }
    states.push(await runTask(task, flags.resume ? resume : null));
    if (flags.once) {
      stopReason = "--once";
      break;
    }
  }
}

// ---------- notes PR: proposed ideas + skip/blocked notes on existing tasks ----------

let notesPr: string | null = null;
if ((proposed.length || notes.length) && !flags.task && !flags.resume) {
  try {
    const slug = `overnight-notes-${runId}`;
    const w = ensureWorktree(slug, base);
    let md = readFileSync(join(w.path, "tasks.md"), "utf8");
    for (const n of notes) md = addNote(md, n.title, n.note);
    md = appendProposed(md, runId, proposed);
    writeFileSync(join(w.path, "tasks.md"), md);
    if (hasChanges(w.path, w.startSha)) {
      squashCommit(
        w.path,
        w.startSha,
        `tasks.md: overnight notes and proposed tasks (${runId})`,
        "Critic verdicts on existing tasks, blocked notes, and ideas that wait for a human.",
      );
      if (push) {
        pushBranch(w.path, w.branch);
        notesPr = openDraftPr(
          w.path,
          w.branch,
          `Overnight ${runId}: proposed tasks and notes`,
          `Only \`tasks.md\` changes: SKIP/BLOCKED notes from tonight's critic and runs, and ${proposed.length} proposed tasks that need a human to move them into the queue. Full reasoning: \`.overnight/${runId}/SUMMARY.md\`.`,
        );
      } else notesPr = `local branch ${w.branch}`;
    }
  } catch (e) {
    log(`Notes PR failed: ${String(e)}`);
  }
}

const summary = summaryReport({
  runId,
  started,
  finished: new Date(),
  spent,
  baseline,
  skills: { ...skills, loaded: loadedSkills ? [...loadedSkills] : null },
  tasks: states,
  ideas: ideaRows,
  existing: existingRows,
  skipped,
  notesPr,
  stopReason,
});
writeFileSync(join(runDir, "SUMMARY.md"), summary);
log(
  `Done. ${states.filter((s) => s.status === "pass").length}/${states.length} passed, $${spent.toFixed(2)} spent. Summary: ${join(runDir, "SUMMARY.md")}`,
);
