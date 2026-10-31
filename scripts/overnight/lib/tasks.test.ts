import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { addNote, appendProposed, checkOff, parseTasks, skipReason, slugify } from "./tasks";

const md = `# Task queue

Intro text.

## Tasks

- [ ] Add a Discord adapter
      Done when: \`src/lib/groups/discord.ts\` posts via a webhook; lint + typecheck pass.

- [x] Seed helpers
      Done when: 15–20 helpers.

- [ ] Make it better

- [ ] Show which details the safety check flagged
      BLOCKED: needs a product call.
      Done when: the reason string shows.

## Later (not tonight)

- [ ] Real email via Gmail SMTP
      Done when: emails send.

## Needs a human (agents: skip)

- [ ] (Human) Create a Gmail app password
      Done when: it exists.
`;

describe("parseTasks", () => {
  const tasks = parseTasks(md);

  it("reads every task with its section, state and indented block", () => {
    expect(tasks.map((t) => t.title)).toEqual([
      "Add a Discord adapter",
      "Seed helpers",
      "Make it better",
      "Show which details the safety check flagged",
      "Real email via Gmail SMTP",
      "(Human) Create a Gmail app password",
    ]);
    expect(tasks[0].section).toBe("Tasks");
    expect(tasks[0].block).toContain("Done when: `src/lib/groups/discord.ts`");
    expect(tasks[1].checked).toBe(true);
    expect(tasks[4].section).toBe("Later (not tonight)");
  });

  it("gives each skip rule its reason, and picks only the clear open task", () => {
    const reasons = tasks.map((t) => skipReason(t));
    expect(reasons[0]).toBeNull();
    expect(reasons[1]).toBe("done");
    expect(reasons[2]).toBe('no "Done when"');
    expect(reasons[3]).toBe("marked BLOCKED or SKIP");
    expect(reasons[4]).toMatch(/humans or later/);
    expect(reasons[5]).toMatch(/humans or later/);
  });

  it("skips a task whose agent branch already exists", () => {
    expect(skipReason(tasks[0], new Set(["agent/add-a-discord-adapter"]))).toMatch(
      /already exists/,
    );
  });

  it("parses the real tasks.md without losing tasks", () => {
    const real = readFileSync(new URL("../../../tasks.md", import.meta.url), "utf8");
    const lines = real.split("\n").filter((l) => /^- \[( |x)\] /.test(l)).length;
    expect(parseTasks(real)).toHaveLength(lines);
  });
});

describe("edits", () => {
  it("checks off exactly the named task", () => {
    const out = checkOff(md, "Add a Discord adapter");
    expect(out).toContain("- [x] Add a Discord adapter");
    expect(out).toContain("- [ ] Make it better");
  });

  it("adds a note under the task line, making the task skipped next time", () => {
    const out = addNote(md, "Add a Discord adapter", "BLOCKED: needs\n a key");
    expect(out).toContain("- [ ] Add a Discord adapter\n      BLOCKED: needs a key\n");
    expect(skipReason(parseTasks(out)[0])).toBe("marked BLOCKED or SKIP");
  });

  it("leaves the file alone for an unknown title", () => {
    expect(checkOff(md, "Nope")).toBe(md);
  });

  it("appends proposed tasks in a section agents skip", () => {
    const out = appendProposed(md, "20261031-0200", [
      { title: "Add X", doneWhen: "X works.", note: "Why: y." },
    ]);
    const proposed = parseTasks(out).find((t) => t.title === "Add X");
    expect(proposed?.section).toMatch(/Proposed by overnight run/);
    expect(skipReason(proposed!)).toMatch(/humans or later/);
    expect(appendProposed(md, "r", [])).toBe(md);
  });
});

describe("slugify", () => {
  it("makes short branch-safe slugs", () => {
    expect(slugify('Add the extension-email option to the "write my essay" redirect')).toBe(
      "add-the-extension-email-option-to-the-wr",
    );
    expect(slugify("Unit-test postAsk guards")).toBe("unit-test-postask-guards");
    expect(slugify("  --Hi!--  ")).toBe("hi");
  });
});
