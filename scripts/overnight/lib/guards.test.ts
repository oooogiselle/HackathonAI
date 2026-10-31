import { describe, expect, it } from "vitest";

import { checkGuards, parseNameStatus } from "./guards";
import { deadline } from "./rules";

const diffOf = (path: string, added: string[], removed: string[] = []) =>
  [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    "@@ -1,1 +1,1 @@",
    ...removed.map((l) => `-${l}`),
    ...added.map((l) => `+${l}`),
  ].join("\n");

describe("checkGuards", () => {
  it("passes a normal change with a new test", () => {
    const diff =
      diffOf("src/lib/x.ts", ["export const x = 1;"]) +
      "\n" +
      diffOf("src/lib/x.test.ts", ['it("works", () => {});']);
    const res = checkGuards(diff, parseNameStatus("M\tsrc/lib/x.ts\nA\tsrc/lib/x.test.ts"), 600);
    expect(res).toEqual({ failures: [], warnings: [] });
  });

  it("fails on .skip / .only and on deleted test files", () => {
    const diff = diffOf("src/a.test.ts", [
      'it.skip("flaky", () => {});',
      'test.only("x", () => {});',
    ]);
    const res = checkGuards(
      diff,
      parseNameStatus("M\tsrc/a.test.ts\nD\te2e/demo-path.spec.ts"),
      600,
    );
    expect(res.failures.join("\n")).toMatch(/\.skip\/\.only/);
    expect(res.failures.join("\n")).toMatch(/deleted test file e2e\/demo-path\.spec\.ts/);
  });

  it("fails when tests are removed without replacement", () => {
    const diff = diffOf("src/a.test.ts", [], ['it("one", () => {});', 'it("two", () => {});']);
    expect(checkGuards(diff, parseNameStatus("M\tsrc/a.test.ts"), 600).failures[0]).toMatch(
      /fewer tests/,
    );
  });

  it("fails on env files and edits to existing migrations, but allows new migrations", () => {
    const res = checkGuards(
      "",
      parseNameStatus("M\t.env.example\nM\tdrizzle/0002_ask_tables.sql\nA\tdrizzle/0003_new.sql"),
      600,
    );
    expect(res.failures).toHaveLength(2);
    expect(res.failures.join("\n")).not.toMatch(/0003/);
  });

  it("fails on a new emoji but not on editing a line that already had one", () => {
    expect(checkGuards(diffOf("src/a.ts", ['const s = "Done 🎉";']), [], 600).failures[0]).toMatch(
      /emoji/,
    );
    const edited = diffOf("src/a.ts", ['const s = "✅ Covered!";'], ['const s = "✅ Covered";']);
    expect(checkGuards(edited, [], 600).failures).toEqual([]);
  });

  it("caps diff size, ignoring the lockfile", () => {
    const big = Array.from({ length: 50 }, (_, i) => `line ${i}`);
    expect(checkGuards(diffOf("src/a.ts", big), [], 40).failures[0]).toMatch(/adds 50 lines/);
    expect(checkGuards(diffOf("pnpm-lock.yaml", big), [], 40).failures).toEqual([]);
  });

  it("warns (not fails) on protected paths", () => {
    const res = checkGuards(
      "",
      parseNameStatus("M\tsrc/lib/ai/ask/safety-check.ts\nR100\told.ts\tsrc/lib/groups/x.ts"),
      600,
    );
    expect(res.failures).toEqual([]);
    expect(res.warnings).toHaveLength(2);
  });
});

describe("deadline", () => {
  it("is later today, or tomorrow if that time has passed", () => {
    const night = new Date(2026, 9, 30, 23, 0);
    expect(deadline(night, "07:30")).toEqual(new Date(2026, 9, 31, 7, 30));
    const early = new Date(2026, 9, 31, 1, 0);
    expect(deadline(early, "07:30")).toEqual(new Date(2026, 9, 31, 7, 30));
  });
});
