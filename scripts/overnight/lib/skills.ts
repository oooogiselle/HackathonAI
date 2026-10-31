// Which skills each stage uses, where to find them on the host, and how to hand them to the
// container. Only the listed skill folders are copied: no credentials or MCP config cross over.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type SkillRef =
  | { name: string; kind: "builtin" }
  | { name: string; kind: "personal" }
  | { name: string; kind: "plugin"; plugin: string }
  | { name: string; kind: "command"; plugin: string };

type Use = { ref: SkillRef; purpose: string; when?: (paths: string[]) => boolean };

const plugin = (p: string, name: string): SkillRef => ({ name, kind: "plugin", plugin: p });
const command = (p: string, name: string): SkillRef => ({ name, kind: "command", plugin: p });
const personal = (name: string): SkillRef => ({ name, kind: "personal" });
const builtin = (name: string): SkillRef => ({ name, kind: "builtin" });

const touches =
  (...patterns: RegExp[]) =>
  (paths: string[]) =>
    paths.some((p) => patterns.some((re) => re.test(p)));
const UI = /^src\/(app|components)\//;
const AI = /^src\/lib\/ai\//;
const DATA = /^(src\/db\/|drizzle\/|src\/lib\/ask\/(board-store|db)\.ts)/;
const SERVER = /^(src\/server\/actions\/|src\/lib\/ask\/board-store\.ts|src\/lib\/groups\/)/;

const nextjs: Use = {
  ref: plugin("vercel", "nextjs"),
  purpose:
    "this repo's Next.js version differs from your training data (see AGENTS.md); check APIs here first",
};

export const STAGE_SKILLS: Record<string, Use[]> = {
  ideate: [
    {
      ref: plugin("pm-ai-shipping", "intended-vs-implemented"),
      purpose:
        "find where the code and docs/PRD.md or CLAUDE.md disagree; those gaps are the best ideas",
    },
    {
      ref: plugin("pm-product-discovery", "brainstorm-ideas-existing"),
      purpose:
        "widen the list with ideas for the existing product, judged against the PRD's demo path",
    },
    {
      ref: plugin("pm-product-discovery", "prioritize-features"),
      purpose: "rank the ideas by demo impact against effort before you pick the final list",
    },
  ],
  critique: [
    {
      ref: plugin("pm-execution", "strategy-red-team"),
      purpose: "attack each item's load-bearing assumptions",
    },
    {
      ref: plugin("pm-execution", "pre-mortem"),
      purpose: "imagine it shipped and broke the demo; say how",
    },
  ],
  spec: [
    {
      ref: personal("prd-writing"),
      purpose: "write the mini-PRD; docs/PRD.md is the parent doc, so never contradict it",
    },
  ],
  architecture: [
    {
      ref: personal("architecture-design"),
      purpose: "structure the design: components, data flow, failure modes",
    },
    nextjs,
    {
      ref: personal("database-designer"),
      purpose: "for schema or query changes (guarded UPDATE ... RETURNING, new migrations only)",
      when: touches(DATA),
    },
    {
      ref: command("pm-ai-shipping", "derive-tests"),
      purpose: "map each acceptance criterion to a unit or e2e test for the test plan",
    },
  ],
  analysis: [
    {
      ref: plugin("pm-execution", "strategy-red-team"),
      purpose: "attack the design's load-bearing assumptions",
    },
    {
      ref: plugin("pm-execution", "pre-mortem"),
      purpose: "how this fails during the demo recording",
    },
    {
      ref: plugin("pm-ai-shipping", "intended-vs-implemented"),
      purpose: "check the spec and design against docs/PRD.md and CLAUDE.md",
    },
  ],
  implement: [
    nextjs,
    {
      ref: plugin("frontend-design", "frontend-design"),
      purpose: "for screens: mobile-first, match the existing components and tokens",
      when: touches(UI),
    },
    {
      ref: builtin("claude-api"),
      purpose: "for AI steps: model ids, structured output, fallbacks",
      when: touches(AI),
    },
    {
      ref: personal("database-designer"),
      purpose: "for schema or query changes",
      when: touches(DATA),
    },
  ],
  break: [
    {
      ref: plugin("pm-execution", "test-scenarios"),
      purpose: "list edge cases and error paths, then write the strongest ones as real tests",
    },
  ],
  review: [
    {
      ref: builtin("code-review"),
      purpose: "review the staged diff at high effort; report only, don't fix",
    },
    {
      ref: builtin("security-review"),
      purpose: "the diff touches server actions, the card store or the bot",
      when: touches(SERVER),
    },
    {
      ref: command("pm-ai-shipping", "security-audit-static"),
      purpose: "run it with `changes` for trust boundaries the diff opens",
      when: touches(SERVER),
    },
  ],
  fix: [nextjs],
  polish: [{ ref: builtin("simplify"), purpose: "simplify the diff without changing behavior" }],
};

/** All refs any stage may use (for preparing the container's skill folder). */
export function allRefs(): SkillRef[] {
  const seen = new Map<string, SkillRef>();
  for (const uses of Object.values(STAGE_SKILLS)) for (const u of uses) seen.set(u.ref.name, u.ref);
  return [...seen.values()];
}

/** The skills a stage should use, given the files it is about to touch. */
export function skillsFor(stage: string, paths: string[] = []): Use[] {
  return (STAGE_SKILLS[stage] ?? []).filter((u) => !u.when || u.when(paths));
}

const listDirs = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => join(dir, d.name))
    : [];

/** Finds a skill folder (or command file) under a host ~/.claude, newest first. Skips .trash. */
export function findSkill(claudeHome: string, ref: SkillRef): string | null {
  let candidates: string[] = [];
  if (ref.kind === "builtin") return null;
  if (ref.kind === "personal") {
    candidates = [join(claudeHome, "skills", ref.name)];
  } else {
    const roots = [
      ...listDirs(join(claudeHome, "plugins", "synced")).map((d) => join(d, ref.plugin)),
      ...listDirs(join(claudeHome, "plugins", "cache")).flatMap((m) =>
        listDirs(join(m, ref.plugin)),
      ),
    ];
    candidates =
      ref.kind === "plugin"
        ? roots.map((r) => join(r, "skills", ref.name))
        : roots.map((r) => join(r, "commands", `${ref.name}.md`));
  }
  const found = candidates
    .filter((p) => !p.includes("/.trash/"))
    .filter((p) => (ref.kind === "command" ? existsSync(p) : existsSync(join(p, "SKILL.md"))))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return found[0] ?? null;
}

/**
 * Copies every skill the pipeline uses into `dest/skills/<name>` and `dest/commands/<name>.md`.
 * Returns what was copied and what wasn't found. Built-ins ship with the CLI and aren't copied.
 */
export function prepareSkills(
  claudeHome: string,
  dest: string,
): { copied: string[]; missing: string[] } {
  mkdirSync(join(dest, "skills"), { recursive: true });
  mkdirSync(join(dest, "commands"), { recursive: true });
  const copied: string[] = [];
  const missing: string[] = [];
  for (const ref of allRefs()) {
    if (ref.kind === "builtin") continue;
    const src = findSkill(claudeHome, ref);
    if (!src) {
      missing.push(ref.name);
      continue;
    }
    const target =
      ref.kind === "command"
        ? join(dest, "commands", `${ref.name}.md`)
        : join(dest, "skills", ref.name);
    cpSync(src, target, { recursive: true, dereference: true });
    copied.push(ref.name);
  }
  return { copied, missing };
}

/** Skill and command names from the CLI's stream-json `init` event, without plugin prefixes. */
export function parseInitSkills(streamJson: string): Set<string> | null {
  for (const line of streamJson.split("\n")) {
    if (!line.startsWith("{")) continue;
    try {
      const ev = JSON.parse(line) as {
        type?: string;
        subtype?: string;
        skills?: unknown;
        slash_commands?: unknown;
      };
      if (ev.type !== "system" || ev.subtype !== "init") continue;
      const names = [ev.skills, ev.slash_commands]
        .filter(Array.isArray)
        .flat()
        .map((n) =>
          String(typeof n === "object" && n && "name" in n ? (n as { name: string }).name : n),
        )
        .map((n) => n.replace(/^\//, "").split(":").pop() ?? n);
      return new Set(names);
    } catch {
      // Not JSON; keep looking.
    }
  }
  return null;
}

/** The "Skills for this stage" section of a prompt. `available` is null when the smoke test couldn't tell. */
export function skillsPrompt(uses: Use[], available: Set<string> | null): string {
  if (uses.length === 0) return "";
  const lines = uses.map((u) => {
    const note =
      available && !available.has(u.ref.name)
        ? " (not installed in this session: do it by hand)"
        : "";
    return `- \`${u.ref.name}\`: ${u.purpose}${note}`;
  });
  return [
    "## Skills for this stage",
    "",
    "Load each one with the Skill tool before the part of the work it covers:",
    "",
    ...lines,
    "",
    "If a skill isn't available, do what it describes by hand and say so in your output. Never stop because a skill is missing.",
  ].join("\n");
}
