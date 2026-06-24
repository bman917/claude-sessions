# Full-content Detail Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the full conversation in the detail pane — tool calls + results, `Task` agent spawning, and thinking — as compact summaries with a `Ctrl+O` expand toggle driven by a block cursor.

**Architecture:** Data flows filesystem → pure parser (`Block[]`) → pure render (`Line[]` + block line-`ranges`) → block-cursor nav → Ink component. We replace the flat `Turn` model with a `Block` union, replace pure line-scroll (`computeScroll`) with a block-cursor scroller (`computeBlockScroll`), and wire expand state into `App`.

**Tech Stack:** Bun, TypeScript, Ink + React, `bun:test`.

## Global Constraints

- Runtime is **Bun** (not Node); tests use `bun:test` (`import { describe, it, expect } from "bun:test"`).
- macOS/arm64-only tool — do not add cross-platform shims.
- Keep parsing/render/nav logic in **pure functions**; tests live in `src/__tests__/` and cover those only — **no React component tests**.
- `useInput` handlers must stay mutually exclusive via their `isActive`/`enabled` flag — overlapping active handlers double-handle keys.
- Data flows one direction: filesystem → pure parsers → React state → Ink render. The only filesystem reader is `src/sessions.ts`.

---

## File Structure

- `src/types.ts` — replace `Turn` with the `Block` union (Task 1).
- `src/sessions.ts` — replace `loadTurns` with pure `entriesToBlocks` + disk-reading `loadBlocks` (Task 1).
- `src/render.ts` — replace `turnsToLines` with `blocksToLines` + `summarizeTool`; keep `wrapText` (Task 2).
- `src/nav.ts` — add `computeBlockScroll` + `useBlockNav`; remove `computeScroll` + `useScroll` (Task 3).
- `src/components/SessionDetail.tsx` — add focused-block gutter highlight (Task 4).
- `src/components/App.tsx` — wire `blocks`, `expanded`, `useBlockNav`, `Ctrl+O` (Task 5).
- Tests: `src/__tests__/sessions.test.ts`, `render.test.ts`, `nav.test.ts` updated; `scroll.test.ts` deleted.

---

## Task 1: Block model + parsing

**Files:**
- Modify: `src/types.ts` (replace `Turn`)
- Modify: `src/sessions.ts` (replace `loadTurns` with `entriesToBlocks` + `loadBlocks`)
- Test: `src/__tests__/sessions.test.ts` (replace the `loadTurns` describe block)

**Interfaces:**
- Consumes: existing `isHumanTypedMessage`, `Session` type.
- Produces:
  - `type Block` (union) in `src/types.ts`.
  - `entriesToBlocks(entries: Record<string, unknown>[]): { blocks: Block[]; turnCount: number }`
  - `loadBlocks(session: Session): { blocks: Block[]; turnCount: number }`

- [ ] **Step 1: Replace `Turn` in `src/types.ts`**

Delete the `Turn` interface (lines 13-17) and add:

```typescript
export type Block =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "thinking"; text: string }
  | {
      kind: "tool";
      name: string;
      input: Record<string, unknown>;
      result?: { text: string; isError: boolean };
    };
```

- [ ] **Step 2: Write the failing test**

Replace the entire `describe("loadTurns", ...)` block (and the `loadTurns` import) in `src/__tests__/sessions.test.ts`. Change the import line to:

```typescript
import { parseLines, entriesToBlocks } from "../sessions";
```

Then append:

```typescript
describe("entriesToBlocks", () => {
  const human = (text: string) => ({
    type: "user",
    message: { role: "user", content: text },
    origin: { kind: "human" },
    promptSource: "typed",
  });

  it("emits user, assistant, and thinking blocks in order", () => {
    const { blocks, turnCount } = entriesToBlocks([
      human("Hello"),
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "hmm" },
            { type: "text", text: "Hi there!" },
          ],
        },
      },
    ]);
    expect(blocks).toEqual([
      { kind: "user", text: "Hello" },
      { kind: "thinking", text: "hmm" },
      { kind: "assistant", text: "Hi there!" },
    ]);
    expect(turnCount).toBe(1);
  });

  it("pairs a tool_use with its tool_result by id", () => {
    const { blocks } = entriesToBlocks([
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } }],
        },
      },
      {
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "t1", content: "a\nb", is_error: false }],
        },
      },
    ]);
    expect(blocks).toEqual([
      { kind: "tool", name: "Bash", input: { command: "ls" }, result: { text: "a\nb", isError: false } },
    ]);
  });

  it("flattens array tool_result content to text and treats is_error null as not-error", () => {
    const { blocks } = entriesToBlocks([
      {
        type: "assistant",
        message: { role: "assistant", content: [{ type: "tool_use", id: "t2", name: "Read", input: {} }] },
      },
      {
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "t2",
              content: [{ type: "text", text: "line1" }, { type: "tool_reference" }, { type: "text", text: "line2" }],
              is_error: null,
            },
          ],
        },
      },
    ]);
    expect(blocks[0]).toEqual({
      kind: "tool",
      name: "Read",
      input: {},
      result: { text: "line1\nline2", isError: false },
    });
  });

  it("leaves result undefined when a tool_use has no matching result", () => {
    const { blocks } = entriesToBlocks([
      {
        type: "assistant",
        message: { role: "assistant", content: [{ type: "tool_use", id: "t3", name: "Bash", input: {} }] },
      },
    ]);
    expect(blocks).toEqual([{ kind: "tool", name: "Bash", input: {} }]);
  });

  it("ignores empty text blocks and non-typed user entries", () => {
    const { blocks, turnCount } = entriesToBlocks([
      { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "   " }] } },
      { type: "user", message: { role: "user", content: "synthetic" } }, // not human-typed
    ]);
    expect(blocks).toEqual([]);
    expect(turnCount).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/__tests__/sessions.test.ts`
Expected: FAIL — `entriesToBlocks` is not exported / not a function.

- [ ] **Step 4: Implement `entriesToBlocks` and `loadBlocks`**

In `src/sessions.ts`, change the type import to `import type { Session, Block } from "./types";`, then **delete the entire `loadTurns` function** (lines 64-112) and replace it with:

```typescript
function flattenResultContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b?.type === "text" && typeof b.text === "string")
      .map((b: any) => b.text)
      .join("\n");
  }
  return "";
}

export function entriesToBlocks(
  entries: Record<string, unknown>[]
): { blocks: Block[]; turnCount: number } {
  const blocks: Block[] = [];
  const toolById = new Map<string, Extract<Block, { kind: "tool" }>>();
  let turnCount = 0;

  for (const entry of entries) {
    if (isHumanTypedMessage(entry)) {
      blocks.push({ kind: "user", text: (entry as any).message.content as string });
      turnCount++;
      continue;
    }

    if (entry.type === "assistant") {
      const content = (entry as any).message?.content;
      if (!Array.isArray(content)) continue;
      for (const b of content) {
        if (b?.type === "text") {
          const text = (b.text ?? "").trim();
          if (text) blocks.push({ kind: "assistant", text });
        } else if (b?.type === "thinking") {
          const text = (b.thinking ?? "").trim();
          if (text) blocks.push({ kind: "thinking", text });
        } else if (b?.type === "tool_use") {
          const tool: Extract<Block, { kind: "tool" }> = {
            kind: "tool",
            name: b.name,
            input: b.input ?? {},
          };
          blocks.push(tool);
          if (typeof b.id === "string") toolById.set(b.id, tool);
        }
      }
      continue;
    }

    if (entry.type === "user") {
      const content = (entry as any).message?.content;
      if (!Array.isArray(content)) continue;
      for (const b of content) {
        if (b?.type === "tool_result" && typeof b.tool_use_id === "string") {
          const tool = toolById.get(b.tool_use_id);
          if (tool) {
            tool.result = { text: flattenResultContent(b.content), isError: b.is_error === true };
          }
        }
      }
    }
  }

  return { blocks, turnCount };
}

export function loadBlocks(session: Session): { blocks: Block[]; turnCount: number } {
  const content = readFileSync(session.filePath, "utf-8");
  const entries: Record<string, unknown>[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return entriesToBlocks(entries);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/__tests__/sessions.test.ts`
Expected: PASS (all `parseLines` and `entriesToBlocks` tests green).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/sessions.ts src/__tests__/sessions.test.ts
git commit -m "feat: parse transcripts into a full Block model"
```

---

## Task 2: Render blocks to lines

**Files:**
- Modify: `src/render.ts` (keep `wrapText`; replace `turnsToLines`)
- Test: `src/__tests__/render.test.ts` (replace the `turnsToLines` describe block)

**Interfaces:**
- Consumes: `Block` from `src/types.ts`, existing `wrapText`.
- Produces:
  - `interface Line { text: string; color?: string; bold?: boolean; dim?: boolean; blockIndex: number; }`
  - `summarizeTool(name: string, input: Record<string, unknown>): string`
  - `blocksToLines(blocks: Block[], width: number, expanded: Set<number>): { lines: Line[]; ranges: { start: number; len: number }[] }`

- [ ] **Step 1: Write the failing test**

In `src/__tests__/render.test.ts`, change imports to:

```typescript
import { wrapText, blocksToLines, summarizeTool } from "../render";
import type { Block } from "../types";
```

Keep the existing `describe("wrapText", ...)` block. Delete the `turn()` helper and the `describe("turnsToLines", ...)` block, and append:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/render.test.ts`
Expected: FAIL — `blocksToLines` / `summarizeTool` not exported.

- [ ] **Step 3: Implement `src/render.ts`**

Keep `wrapText` exactly as-is. Replace the `Line` interface and the `turnsToLines` function with:

```typescript
import path from "path";
import type { Block } from "./types";

export interface Line {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
  blockIndex: number;
}

const PREVIEW_RESULT_LINES = 3;
const PREVIEW_THINKING_LINES = 2;
const SUMMARY_MAX = 60;

function truncate(s: string, n: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n - 1) + "…" : flat;
}

export function summarizeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "Bash":
      return truncate(String(input.command ?? ""), SUMMARY_MAX);
    case "Read":
    case "Edit":
    case "Write":
      return path.basename(String(input.file_path ?? ""));
    case "Grep":
    case "Glob":
      return truncate(String(input.pattern ?? ""), SUMMARY_MAX);
    case "Task":
      return truncate(String(input.description ?? ""), SUMMARY_MAX);
    default: {
      const first = Object.values(input)[0];
      return first === undefined ? "" : truncate(String(first), SUMMARY_MAX);
    }
  }
}

function expandInput(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "Bash":
      return String(input.command ?? "");
    case "Edit":
      return `- ${String(input.old_string ?? "")}\n+ ${String(input.new_string ?? "")}`;
    case "Write":
      return String(input.content ?? "");
    case "Task":
      return String(input.prompt ?? "");
    case "Read":
    case "Grep":
    case "Glob":
      return "";
    default:
      return JSON.stringify(input, null, 2);
  }
}

export function blocksToLines(
  blocks: Block[],
  width: number,
  expanded: Set<number>
): { lines: Line[]; ranges: { start: number; len: number }[] } {
  const lines: Line[] = [];
  const ranges: { start: number; len: number }[] = [];
  const body = Math.max(1, width - 2);
  const resultBody = Math.max(1, width - 4);

  blocks.forEach((block, i) => {
    const start = lines.length;
    const push = (text: string, opts: Partial<Line> = {}) =>
      lines.push({ text, blockIndex: i, ...opts });
    const isOpen = expanded.has(i);

    if (block.kind === "user" || block.kind === "assistant") {
      const isUser = block.kind === "user";
      push(isUser ? "You" : "Claude", { color: isUser ? "green" : "blue", bold: true });
      for (const cl of wrapText(block.text, body)) push("  " + cl);
    } else if (block.kind === "thinking") {
      push("✻ Thinking", { dim: true });
      const wrapped = wrapText(block.text, body);
      const shown = isOpen ? wrapped : wrapped.slice(0, PREVIEW_THINKING_LINES);
      for (const cl of shown) push("  " + cl, { dim: true });
      if (!isOpen && wrapped.length > shown.length)
        push(`  … +${wrapped.length - shown.length} more`, { dim: true });
    } else {
      const isTask = block.name === "Task";
      const summary = summarizeTool(block.name, block.input);
      if (isTask) {
        const sub = String(block.input.subagent_type ?? "agent");
        push(`◆ Task(${sub})  ${summary}`, { color: "magenta", bold: true });
      } else {
        push(`▸ ${block.name}  ${summary}`, { color: "cyan", bold: true });
      }

      if (isOpen) {
        const inputText = expandInput(block.name, block.input);
        if (inputText) for (const cl of wrapText(inputText, body)) push("  " + cl, { dim: true });
      }

      if (block.result) {
        const resultLines = block.result.text.split("\n");
        const status = block.result.isError ? "error" : "ok";
        push(`  └ ${status} · ${resultLines.length} lines`, {
          color: block.result.isError ? "red" : undefined,
          dim: !block.result.isError,
        });
        const shown = isOpen ? resultLines : resultLines.slice(0, PREVIEW_RESULT_LINES);
        for (const rl of shown) for (const cl of wrapText(rl, resultBody)) push("    " + cl, { dim: true });
        if (!isOpen && resultLines.length > shown.length)
          push(`    … +${resultLines.length - shown.length} more`, { dim: true });
      } else {
        push("  └ (no result)", { dim: true });
      }
    }

    push(""); // blank separator, tagged to this block
    ranges.push({ start, len: lines.length - start });
  });

  return { lines, ranges };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/render.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render.ts src/__tests__/render.test.ts
git commit -m "feat: render blocks as compact/expandable lines with ranges"
```

---

## Task 3: Block-cursor navigation

**Files:**
- Modify: `src/nav.ts` (add `computeBlockScroll` + `useBlockNav`; remove `computeScroll` + `useScroll`)
- Test: `src/__tests__/nav.test.ts` (add `computeBlockScroll` tests)
- Delete: `src/__tests__/scroll.test.ts`

**Interfaces:**
- Consumes: existing `NavAction` type.
- Produces:
  - `computeBlockScroll(state: { cursor: number; offset: number }, action: NavAction, ranges: { start: number; len: number }[], totalLines: number, visibleRows: number): { cursor: number; offset: number }`
  - `useBlockNav(ranges: { start: number; len: number }[], totalLines: number, visibleRows: number, enabled: boolean): { cursor: number; offset: number; reset: () => void }`

- [ ] **Step 1: Delete the obsolete scroll test**

```bash
git rm src/__tests__/scroll.test.ts
```

- [ ] **Step 2: Write the failing test**

Append to `src/__tests__/nav.test.ts` (add `computeBlockScroll` to the import):

```typescript
import { computeNav, computeBlockScroll } from "../nav";

describe("computeBlockScroll", () => {
  // three blocks of 2 lines each → 6 total lines
  const ranges = [
    { start: 0, len: 2 },
    { start: 2, len: 2 },
    { start: 4, len: 2 },
  ];

  it("moves the cursor to the next block when it already fits", () => {
    const r = computeBlockScroll({ cursor: 0, offset: 0 }, "down", ranges, 6, 6);
    expect(r).toEqual({ cursor: 1, offset: 0 });
  });

  it("scrolls within a block taller than the viewport instead of advancing", () => {
    const tall = [{ start: 0, len: 10 }];
    const r = computeBlockScroll({ cursor: 0, offset: 0 }, "down", tall, 10, 4);
    expect(r).toEqual({ cursor: 0, offset: 1 });
  });

  it("brings the next block into view when it would fall below the viewport", () => {
    // viewport shows 2 lines; on block 0, advancing to block 1 (lines 2-3) needs offset 2
    const r = computeBlockScroll({ cursor: 0, offset: 0 }, "down", ranges, 6, 2);
    expect(r.cursor).toBe(1);
    expect(r.offset).toBe(2);
  });

  it("retreats the cursor and reveals the previous block", () => {
    const r = computeBlockScroll({ cursor: 2, offset: 4 }, "up", ranges, 6, 2);
    expect(r.cursor).toBe(1);
    expect(r.offset).toBe(2);
  });

  it("jumps to top and bottom", () => {
    expect(computeBlockScroll({ cursor: 2, offset: 4 }, "top", ranges, 6, 2)).toEqual({ cursor: 0, offset: 0 });
    const bottom = computeBlockScroll({ cursor: 0, offset: 0 }, "bottom", ranges, 6, 2);
    expect(bottom.cursor).toBe(2);
    expect(bottom.offset).toBe(4); // maxOffset = 6 - 2
  });

  it("half-page down snaps the cursor to the topmost visible block", () => {
    const r = computeBlockScroll({ cursor: 0, offset: 0 }, "halfDown", ranges, 6, 4);
    expect(r.offset).toBe(2); // +half (2)
    expect(r.cursor).toBe(1); // block whose range covers line 2
  });

  it("returns zeroed state for empty ranges", () => {
    expect(computeBlockScroll({ cursor: 3, offset: 9 }, "down", [], 0, 5)).toEqual({ cursor: 0, offset: 0 });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/__tests__/nav.test.ts`
Expected: FAIL — `computeBlockScroll` not exported.

- [ ] **Step 4: Implement nav changes**

In `src/nav.ts`, **delete `computeScroll` and `useScroll`** (the whole "Content scrolling" section). Keep `computeNav`, `useVimNav`, and `NavAction`. Add:

```typescript
type Range = { start: number; len: number };

export function computeBlockScroll(
  state: { cursor: number; offset: number },
  action: NavAction,
  ranges: Range[],
  totalLines: number,
  visibleRows: number
): { cursor: number; offset: number } {
  if (ranges.length === 0) return { cursor: 0, offset: 0 };

  const maxOffset = Math.max(0, totalLines - visibleRows);
  const clampOffset = (n: number) => Math.max(0, Math.min(n, maxOffset));
  const clampCursor = (n: number) => Math.max(0, Math.min(n, ranges.length - 1));
  const half = Math.max(1, Math.floor(visibleRows / 2));

  // Offset that brings block `c` into view, aligning a too-tall block to the top.
  const visibleOffset = (c: number, offset: number): number => {
    const { start, len } = ranges[c];
    const end = start + len; // exclusive
    let off = offset;
    if (start < off) off = start;
    else if (end > off + visibleRows) off = len >= visibleRows ? start : end - visibleRows;
    return clampOffset(off);
  };

  // First block whose range reaches past `offset` (topmost visible).
  const topmost = (offset: number): number => {
    for (let i = 0; i < ranges.length; i++) {
      if (ranges[i].start + ranges[i].len > offset) return i;
    }
    return ranges.length - 1;
  };

  const { cursor, offset } = state;
  const cur = ranges[clampCursor(cursor)];

  switch (action) {
    case "top":
      return { cursor: 0, offset: 0 };
    case "bottom":
      return { cursor: ranges.length - 1, offset: maxOffset };
    case "down": {
      if (cur.start + cur.len > offset + visibleRows) {
        return { cursor: clampCursor(cursor), offset: clampOffset(offset + 1) };
      }
      const next = clampCursor(cursor + 1);
      return { cursor: next, offset: visibleOffset(next, offset) };
    }
    case "up": {
      if (cur.start < offset) {
        return { cursor: clampCursor(cursor), offset: clampOffset(offset - 1) };
      }
      const prev = clampCursor(cursor - 1);
      return { cursor: prev, offset: clampOffset(Math.min(offset, ranges[prev].start)) };
    }
    case "halfDown": {
      const off = clampOffset(offset + half);
      return { cursor: topmost(off), offset: off };
    }
    case "halfUp": {
      const off = clampOffset(offset - half);
      return { cursor: topmost(off), offset: off };
    }
  }
}

export function useBlockNav(
  ranges: Range[],
  totalLines: number,
  visibleRows: number,
  enabled: boolean
): { cursor: number; offset: number; reset: () => void } {
  const [state, setState] = useState({ cursor: 0, offset: 0 });
  const lastGTime = useRef(0);

  // Re-clamp when content or viewport changes (e.g. expand/collapse reflows lines).
  useEffect(() => {
    const maxOffset = Math.max(0, totalLines - visibleRows);
    setState((prev) => ({
      cursor: ranges.length === 0 ? 0 : Math.min(prev.cursor, ranges.length - 1),
      offset: Math.min(prev.offset, maxOffset),
    }));
  }, [totalLines, visibleRows, ranges.length]);

  useInput(
    (input, key) => {
      const step = (action: NavAction) =>
        setState((prev) => computeBlockScroll(prev, action, ranges, totalLines, visibleRows));
      if (input === "j" || key.downArrow) step("down");
      else if (input === "k" || key.upArrow) step("up");
      else if (input === "G") step("bottom");
      else if (input === "g") {
        const now = Date.now();
        if (now - lastGTime.current < 500) {
          setState({ cursor: 0, offset: 0 });
          lastGTime.current = 0;
        } else lastGTime.current = now;
      } else if (key.ctrl && input === "d") step("halfDown");
      else if (key.ctrl && input === "u") step("halfUp");
    },
    { isActive: enabled }
  );

  const reset = () => setState({ cursor: 0, offset: 0 });
  return { cursor: state.cursor, offset: state.offset, reset };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test src/__tests__/nav.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/nav.ts src/__tests__/nav.test.ts
git commit -m "feat: block-cursor scrolling for the detail pane"
```

---

## Task 4: Detail pane focused-block highlight

**Files:**
- Modify: `src/components/SessionDetail.tsx`

**Interfaces:**
- Consumes: `Line` (now with `dim` + `blockIndex`) from `src/render.ts`.
- Produces: `SessionDetail` accepting a new `cursor: number` prop and rendering a focused-block gutter.

No automated test (React component) — per repo convention. Verified via Task 5's manual run.

- [ ] **Step 1: Add the `cursor` prop and gutter rendering**

In `src/components/SessionDetail.tsx`, add `cursor: number;` to the `Props` interface, add `cursor` to the destructured params, and replace the lines-rendering `<Box flexDirection="column">…</Box>` (lines 46-52) with:

```tsx
      <Box flexDirection="column">
        {visible.map((ln, i) => {
          const focused = ln.blockIndex === cursor;
          return (
            <Box key={scrollOffset + i}>
              <Text color="cyan">{focused ? "▌" : " "}</Text>
              <Text color={ln.color} bold={ln.bold} dimColor={ln.dim} wrap="truncate">
                {ln.text === "" ? " " : ln.text}
              </Text>
            </Box>
          );
        })}
      </Box>
```

- [ ] **Step 2: Update the header hint to mention expand**

Replace the `{focused ? " · scrolling (Esc to list)" : ""}` fragment (line 43) with:

```tsx
          {focused ? " · scrolling · Ctrl+O expand · Esc to list" : ""}
```

- [ ] **Step 3: Typecheck the component compiles**

Run: `bun build src/index.tsx --target=bun --outfile=/dev/null`
Expected: builds without error (App.tsx still passes the old props until Task 5 — if this errors on a missing `cursor` prop, that is expected and resolved in Task 5; proceed).

- [ ] **Step 4: Commit**

```bash
git add src/components/SessionDetail.tsx
git commit -m "feat: highlight the focused block in the detail pane"
```

---

## Task 5: App wiring (blocks, expand, Ctrl+O)

**Files:**
- Modify: `src/components/App.tsx`

**Interfaces:**
- Consumes: `loadBlocks` (Task 1), `blocksToLines` (Task 2), `useBlockNav` (Task 3), `SessionDetail` `cursor` prop (Task 4), `Block` type.

No automated test — verified by full `bun test`, `bun run build`, and a manual `bun run dev` smoke test.

- [ ] **Step 1: Update imports**

In `src/components/App.tsx`, change the relevant imports:

```typescript
import { loadSessions, loadBlocks } from "../sessions";
import { useVimNav, useBlockNav } from "../nav";
import { blocksToLines } from "../render";
import type { Session, Block } from "../types";
```

- [ ] **Step 2: Replace `turns` state with `blocks` + `expanded`**

Delete the line `const [turns, setTurns] = useState<Turn[]>([]);` and in its place add (leave the existing `const [turnCount, setTurnCount] = useState(0);` and `selectedSession` lines untouched):

```typescript
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
```

- [ ] **Step 3: Replace the lines memo and detail nav hook**

Replace the `const lines = useMemo(...)` line with:

```typescript
  // Flatten the selected conversation into scrollable lines + per-block ranges.
  const { lines, ranges } = useMemo(
    () => blocksToLines(blocks, detailWidth, expanded),
    [blocks, detailWidth, expanded]
  );
```

Replace the `useScroll(...)` call with:

```typescript
  const { cursor: detailCursor, offset: detailScroll, reset: resetDetailScroll } = useBlockNav(
    ranges,
    lines.length,
    detailVisibleRows,
    !searchFocused && detailFocused
  );
```

- [ ] **Step 4: Reset blocks/expanded on filter change and on open**

In the `useEffect(() => { resetList(); ... }, [matchedIds])` block, replace `setTurns([]);` with:

```typescript
    setBlocks([]);
    setExpanded(new Set());
```

In the Enter handler (`if (key.return && focus === "list")`), replace the `const { turns: t, turnCount: tc } = loadTurns(session); setTurns(t); setTurnCount(tc);` lines with:

```typescript
        const { blocks: b, turnCount: tc } = loadBlocks(session);
        setBlocks(b);
        setTurnCount(tc);
        setExpanded(new Set());
```

- [ ] **Step 5: Add the `Ctrl+O` expand toggle**

Inside the action `useInput` handler (the one with `{ isActive: !searchFocused }`), add this branch (e.g. right after the `key.escape` branch):

```typescript
      if (key.ctrl && input === "o" && detailFocused) {
        setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(detailCursor)) next.delete(detailCursor);
          else next.add(detailCursor);
          return next;
        });
        return;
      }
```

- [ ] **Step 6: Pass `cursor` to `SessionDetail`**

In the `<SessionDetail ... />` JSX, add the prop:

```tsx
              cursor={detailCursor}
```

- [ ] **Step 7: Run the full test suite**

Run: `bun test`
Expected: PASS — all of `sessions`, `render`, `nav`, `search` tests green; no `scroll.test.ts`.

- [ ] **Step 8: Build to confirm types**

Run: `bun run build`
Expected: compiles to `dist/claude-sessions` with no type errors.

- [ ] **Step 9: Manual smoke test**

Run: `bun run dev`
Verify: open a session (Enter) → detail pane shows tool calls (`▸ Bash …`), thinking (`✻ Thinking`), and any `Task` (`◆ Task(…)`) compactly; `j`/`k` move the `▌` block cursor; `Ctrl+O` expands/collapses the focused tool/thinking block; `Esc` returns to the list. Press `q` to quit.

- [ ] **Step 10: Commit**

```bash
git add src/components/App.tsx
git commit -m "feat: wire full-content blocks and Ctrl+O expand into App"
```

---

## Self-Review Notes (verification of plan against spec)

- Spec sections 1-8 each map to a task: model→T1, parsing→T1, render→T2, nav→T3, app wiring→T5, detail component→T4, mutual-exclusion/search→T3+T5 (gating preserved, `search.ts` untouched), testing→T1-T3.
- `Task` handled as a styled `tool` (no separate kind) — T2 render branch on `name === "Task"`.
- `computeScroll`/`useScroll` and `scroll.test.ts` removed — T3.
- Type names consistent across tasks: `Block`, `entriesToBlocks`/`loadBlocks`, `blocksToLines`/`summarizeTool`, `computeBlockScroll`/`useBlockNav`, `cursor` prop.
- Out-of-scope items (sidechain inlining, images, system/meta display, list/search/resume changes) are not introduced.
