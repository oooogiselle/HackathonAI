import { dirname, join, resolve } from "node:path";

import { sh } from "./proc";

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

/** The main checkout (not a worktree), found through git's common dir. */
const commonDir = resolve(sh("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"]));

export const config = {
  commonDir,
  mainRoot: dirname(commonDir),
  worktreesDir: join(dirname(commonDir), ".claude", "worktrees"),
  overnightDir: join(dirname(commonDir), ".overnight"),
  pipelineDir: resolve(import.meta.dirname, ".."),
  base: process.env.BASE ?? "dev",
  image: process.env.OVERNIGHT_IMAGE ?? "ask-overnight",
  model: process.env.MODEL || undefined,
  maxAttempts: num("MAX_ATTEMPTS", 3),
  maxDesignRounds: num("MAX_DESIGN_ROUNDS", 2),
  maxIdeas: num("MAX_IDEAS", 6),
  maxIdeaTasks: num("MAX_IDEA_TASKS", 3),
  minIdeaScore: num("MIN_IDEA_SCORE", 7),
  maxCostUsd: num("MAX_COST_USD", 40),
  taskBudgetUsd: num("TASK_BUDGET_USD", 12),
  maxDiffLines: num("MAX_DIFF_LINES", 600),
  stopAt: process.env.STOP_AT ?? "07:30",
};

/** Per-stage limits. The budget is also capped by what's left for the task and the night. */
export const STAGES = {
  smoke: { turns: 2, usd: 0.5, readOnly: true },
  ideate: { turns: 40, usd: 3, readOnly: true },
  critique: { turns: 30, usd: 2.5, readOnly: true },
  spec: { turns: 25, usd: 1.5, readOnly: true },
  architecture: { turns: 35, usd: 2, readOnly: true },
  analysis: { turns: 30, usd: 1.5, readOnly: true },
  implement: { turns: 90, usd: 5, readOnly: false },
  break: { turns: 45, usd: 2, readOnly: false },
  review: { turns: 45, usd: 2, readOnly: true },
  fix: { turns: 60, usd: 3, readOnly: false },
  polish: { turns: 30, usd: 1.5, readOnly: false },
} as const;

export type Stage = keyof typeof STAGES;
