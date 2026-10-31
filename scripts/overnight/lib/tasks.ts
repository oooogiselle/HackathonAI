// Reads and edits tasks.md. Pure string functions so they can be unit-tested.

export type Task = {
  title: string;
  slug: string;
  section: string;
  checked: boolean;
  /** The task line plus its indented notes, as written in tasks.md. */
  block: string;
  /** Where the task came from: tasks.md or tonight's ideation. */
  source: "tasks.md" | "idea";
};

/** Sections agents never pick from. */
const HUMAN_SECTIONS = /later|needs a human|proposed by overnight/i;

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

const TASK_LINE = /^- \[( |x)\] (.+)$/;

export function parseTasks(md: string): Task[] {
  const tasks: Task[] = [];
  let section = "";
  let current: { title: string; checked: boolean; lines: string[]; section: string } | null = null;
  const flush = () => {
    if (!current) return;
    tasks.push({
      title: current.title,
      slug: slugify(current.title),
      section: current.section,
      checked: current.checked,
      block: current.lines.join("\n").trimEnd(),
      source: "tasks.md",
    });
    current = null;
  };
  for (const line of md.split("\n")) {
    if (line.startsWith("## ")) {
      flush();
      section = line.slice(3).trim();
      continue;
    }
    const m = TASK_LINE.exec(line);
    if (m) {
      flush();
      current = { title: m[2].trim(), checked: m[1] === "x", lines: [line], section };
      continue;
    }
    if (current) {
      // A blank line followed by non-indented text ends the block.
      if (line.trim() !== "" && !/^\s/.test(line)) flush();
      else current.lines.push(line);
    }
  }
  flush();
  return tasks;
}

/** Why an agent may not pick this task, or null if it may. */
export function skipReason(task: Task, existingBranches: Set<string> = new Set()): string | null {
  if (task.checked) return "done";
  if (HUMAN_SECTIONS.test(task.section)) return `section "${task.section}" is for humans or later`;
  if (/^\(human\)/i.test(task.title)) return "marked (Human)";
  if (!/Done when:/.test(task.block)) return 'no "Done when"';
  if (/\b(BLOCKED|SKIP):/.test(task.block)) return "marked BLOCKED or SKIP";
  if (existingBranches.has(`agent/${task.slug}`)) return `branch agent/${task.slug} already exists`;
  return null;
}

function replaceTaskLine(md: string, title: string, fn: (line: string) => string): string {
  const lines = md.split("\n");
  const i = lines.findIndex((l) => {
    const m = TASK_LINE.exec(l);
    return m !== null && m[2].trim() === title;
  });
  if (i === -1) return md;
  lines[i] = fn(lines[i]);
  return lines.join("\n");
}

export function checkOff(md: string, title: string): string {
  return replaceTaskLine(md, title, (l) => l.replace("- [ ] ", "- [x] "));
}

/** Adds an indented note (e.g. "BLOCKED: needs a key") right under the task line. */
export function addNote(md: string, title: string, note: string): string {
  const oneLine = note.replace(/\s+/g, " ").trim();
  return replaceTaskLine(md, title, (l) => `${l}\n      ${oneLine}`);
}

export type ProposedTask = { title: string; doneWhen: string; note: string };

/** Appends tonight's ideas under a "Proposed by overnight run" section (created if missing). */
export function appendProposed(md: string, runId: string, items: ProposedTask[]): string {
  if (items.length === 0) return md;
  const heading = `## Proposed by overnight run ${runId}`;
  const body = items
    .map((t) => `- [ ] ${t.title}\n      Done when: ${t.doneWhen.trim()}\n      ${t.note.trim()}`)
    .join("\n\n");
  const intro =
    "Ideas from the overnight pipeline, after its critic pass. Agents skip this section until a human moves a task into the queue.";
  return `${md.trimEnd()}\n\n${heading}\n\n${intro}\n\n${body}\n`;
}
