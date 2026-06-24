// src/__tests__/render.test.ts
import { describe, it, expect } from "bun:test";
import { wrapText, blocksToLines, summarizeTool } from "../render";
import type { Block } from "../types";

describe("wrapText", () => {
  it("returns text unchanged when it fits", () => {
    expect(wrapText("hello world", 20)).toEqual(["hello world"]);
  });

  it("wraps on word boundaries", () => {
    expect(wrapText("hello world", 5)).toEqual(["hello", "world"]);
  });

  it("preserves explicit newlines", () => {
    expect(wrapText("a\nb", 10)).toEqual(["a", "b"]);
  });

  it("keeps blank lines from double newlines", () => {
    expect(wrapText("a\n\nb", 10)).toEqual(["a", "", "b"]);
  });

  it("hard-splits words longer than the width", () => {
    expect(wrapText("longwordlongword", 4)).toEqual(["long", "word", "long", "word"]);
  });

  it("returns a single empty line for empty input", () => {
    expect(wrapText("", 10)).toEqual([""]);
  });
});

describe("summarizeTool", () => {
  it("uses the first command line for Bash", () => {
    expect(summarizeTool("Bash", { command: "ls -la\necho hi" })).toBe("ls -la echo hi");
  });
  it("uses the basename for file tools", () => {
    expect(summarizeTool("Read", { file_path: "/a/b/c.ts" })).toBe("c.ts");
  });
  it("uses the pattern for Grep", () => {
    expect(summarizeTool("Grep", { pattern: "foo" })).toBe("foo");
  });
  it("uses the description for Task", () => {
    expect(summarizeTool("Task", { description: "do thing" })).toBe("do thing");
  });
});

describe("blocksToLines", () => {
  it("renders user and assistant blocks in full with a trailing separator", () => {
    const blocks: Block[] = [
      { kind: "user", text: "hi" },
      { kind: "assistant", text: "yo" },
    ];
    const { lines, ranges } = blocksToLines(blocks, 20, new Set());
    expect(lines).toEqual([
      { text: "You", color: "green", bold: true, blockIndex: 0 },
      { text: "  hi", blockIndex: 0 },
      { text: "", blockIndex: 0 },
      { text: "Claude", color: "blue", bold: true, blockIndex: 1 },
      { text: "  yo", blockIndex: 1 },
      { text: "", blockIndex: 1 },
    ]);
    expect(ranges).toEqual([
      { start: 0, len: 3 },
      { start: 3, len: 3 },
    ]);
  });

  it("renders a tool compact with a result summary, expanded with full input + result", () => {
    const blocks: Block[] = [
      { kind: "tool", name: "Bash", input: { command: "make" }, result: { text: "l1\nl2\nl3\nl4", isError: false } },
    ];
    const compact = blocksToLines(blocks, 40, new Set()).lines.map((l) => l.text);
    expect(compact[0]).toBe("▸ Bash  make");
    expect(compact).toContain("  └ ok · 4 lines");
    expect(compact).toContain("    … +1 more"); // 4 result lines, 3 shown

    const open = blocksToLines(blocks, 40, new Set([0])).lines.map((l) => l.text);
    expect(open).toContain("  make"); // full input shown
    expect(open).toContain("    l4"); // all result lines shown
    expect(open).not.toContain("    … +1 more");
  });

  it("marks errored tool results red and renders Task blocks with subagent + description", () => {
    const err = blocksToLines([{ kind: "tool", name: "Bash", input: {}, result: { text: "boom", isError: true } }], 40, new Set());
    const summary = err.lines.find((l) => l.text.startsWith("  └"));
    expect(summary).toMatchObject({ text: "  └ error · 1 lines", color: "red" });

    const task = blocksToLines([{ kind: "tool", name: "Task", input: { subagent_type: "Explore", description: "look" } }], 40, new Set());
    expect(task.lines[0]).toMatchObject({ text: "◆ Task(Explore)  look", color: "magenta", bold: true });
  });

  it("renders thinking compact (preview + more) and dimmed", () => {
    const { lines } = blocksToLines([{ kind: "thinking", text: "a\nb\nc" }], 40, new Set());
    expect(lines[0]).toMatchObject({ text: "✻ Thinking", dim: true });
    expect(lines.map((l) => l.text)).toContain("  … +1 more"); // 3 lines, 2 shown
  });
});
