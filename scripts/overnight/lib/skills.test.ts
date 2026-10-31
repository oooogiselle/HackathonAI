import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { findSkill, parseInitSkills, prepareSkills, skillsFor, skillsPrompt } from "./skills";

function skill(dir: string, mtime?: Date) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), "---\nname: x\n---\n");
  if (mtime) utimesSync(join(dir, "SKILL.md"), mtime, mtime);
}

describe("findSkill", () => {
  const home = mkdtempSync(join(tmpdir(), "claude-home-"));
  skill(join(home, "skills", "prd-writing"));
  skill(join(home, "plugins", "synced", "uuid-1", "pm-execution", "skills", "pre-mortem"));
  skill(join(home, "plugins", ".trash", "x", "pm-execution", "skills", "test-scenarios"));
  skill(
    join(home, "plugins", "cache", "official", "vercel", "0.49.0", "skills", "nextjs"),
    new Date(2026, 0, 1),
  );
  skill(
    join(home, "plugins", "cache", "official", "vercel", "0.50.0", "skills", "nextjs"),
    new Date(2026, 5, 1),
  );
  mkdirSync(join(home, "plugins", "synced", "uuid-1", "pm-ai-shipping", "commands"), {
    recursive: true,
  });
  writeFileSync(
    join(home, "plugins", "synced", "uuid-1", "pm-ai-shipping", "commands", "derive-tests.md"),
    "x",
  );

  it("finds personal, synced plugin and command skills", () => {
    expect(findSkill(home, { name: "prd-writing", kind: "personal" })).toMatch(
      /skills\/prd-writing$/,
    );
    expect(findSkill(home, { name: "pre-mortem", kind: "plugin", plugin: "pm-execution" })).toMatch(
      /uuid-1/,
    );
    expect(
      findSkill(home, { name: "derive-tests", kind: "command", plugin: "pm-ai-shipping" }),
    ).toMatch(/derive-tests\.md$/);
  });

  it("never uses .trash, and picks the newest cached plugin version", () => {
    expect(
      findSkill(home, { name: "test-scenarios", kind: "plugin", plugin: "pm-execution" }),
    ).toBeNull();
    expect(findSkill(home, { name: "nextjs", kind: "plugin", plugin: "vercel" })).toMatch(
      /0\.50\.0/,
    );
  });

  it("copies what it finds and reports the rest as missing", () => {
    const dest = mkdtempSync(join(tmpdir(), "claude-dest-"));
    const { copied, missing } = prepareSkills(home, dest);
    expect(copied).toEqual(
      expect.arrayContaining(["prd-writing", "pre-mortem", "nextjs", "derive-tests"]),
    );
    expect(missing).toContain("test-scenarios");
    expect(copied).not.toContain("code-review"); // built-in, ships with the CLI
  });
});

describe("skillsFor", () => {
  it("adds file-dependent skills only when the files match", () => {
    const names = (paths: string[]) => skillsFor("implement", paths).map((u) => u.ref.name);
    expect(names([])).toEqual(["nextjs"]);
    expect(names(["src/app/(flow)/share/page.tsx"])).toContain("frontend-design");
    expect(names(["src/lib/ai/ask/draft-ask.ts"])).toContain("claude-api");
    expect(names(["drizzle/0003_x.sql"])).toContain("database-designer");
    expect(skillsFor("review", ["src/server/actions/board.ts"]).map((u) => u.ref.name)).toContain(
      "security-review",
    );
    expect(skillsFor("review", ["src/app/page.tsx"]).map((u) => u.ref.name)).not.toContain(
      "security-review",
    );
  });
});

describe("parseInitSkills and skillsPrompt", () => {
  it("reads skill names from the init event, without plugin prefixes", () => {
    const stream = [
      "not json",
      JSON.stringify({
        type: "system",
        subtype: "init",
        skills: ["pre-mortem", "vercel:nextjs"],
        slash_commands: ["/derive-tests"],
      }),
    ].join("\n");
    expect([...(parseInitSkills(stream) ?? [])]).toEqual(["pre-mortem", "nextjs", "derive-tests"]);
    expect(parseInitSkills("{}")).toBeNull();
  });

  it("marks skills that didn't load, and tells the agent to carry on by hand", () => {
    const text = skillsPrompt(skillsFor("critique"), new Set(["pre-mortem"]));
    expect(text).toContain("`strategy-red-team`");
    expect(text).toMatch(/strategy-red-team`: .*not installed/);
    expect(text).not.toMatch(/pre-mortem`: .*not installed/);
    expect(text).toMatch(/Never stop because a skill is missing/);
  });
});
