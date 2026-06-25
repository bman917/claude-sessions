# In-Session Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add vim-style in-session search to the detail pane — `/` opens a bottom prompt, Enter jumps to the first match, `n`/`N` cycle matches, Esc clears or returns to list.

**Architecture:** Pure logic lives in a new `src/insearch.ts` module (query compile, block matching, line matching). `useBlockNav` gains a `jumpTo` imperative method backed by a new pure `computeScrollTo`. A new `DetailSearchBar` component handles bottom-prompt input. `SessionDetail` accepts a `currentMatch` prop and highlights the matched substring. `App` owns the search state machine and wires everything together.

**Tech Stack:** Bun, Ink, React (functional hooks), TypeScript — no new dependencies.

## Global Constraints

- Runtime: Bun (not Node) — use `bun:test` in all test files, `bun test` to run.
- All logic units must be pure functions in `.ts` files (no React); components in `src/components/`.
- No new npm dependencies.
- Smart-case regex convention: lowercase pattern → case-insensitive; any uppercase → case-sensitive. Same as list search.
- Only the **current** match is highlighted, not all matches.
- Search covers **full block content** (collapsed blocks are auto-expanded when they contain a match).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/insearch.ts` | **Create** | `compileQuery`, `findBlocksMatching`, `findMatches`, `Match` type |
| `src/nav.ts` | **Modify** | Add `computeScrollTo` pure helper; expose `jumpTo` from `useBlockNav` |
| `src/components/DetailSearchBar.tsx` | **Create** | Bottom prompt UI (line-editing, Enter/Esc) |
| `src/components/SessionDetail.tsx` | **Modify** | Accept `currentMatch` + `matchInfo` props; render highlight |
| `src/components/StatusBar.tsx` | **Modify** | Add `/ search · n/N next/prev` to detail hint |
| `src/components/App.tsx` | **Modify** | Detail-search state machine, key gating, wiring |
| `src/__tests__/insearch.test.ts` | **Create** | Tests for `compileQuery`, `findMatches`, `findBlocksMatching` |
| `src/__tests__/nav.test.ts` | **Modify** | Tests for `computeScrollTo` |

---

## Task 1: `src/insearch.ts` — pure search logic

**Files:**
- Create: `src/insearch.ts`
- Create: `src/__tests__/insearch.test.ts`

**Interfaces:**
- Produces:
  - `Match = { lineIndex: number; blockIndex: number; col: number; length: number }`
  - `compileQuery(pattern: string): RegExp | null`
  - `findMatches(lines: Line[], regex: RegExp): Match[]`
  - `findBlocksMatching(blocks: Block[], width: number, regex: RegExp): Set<number>`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/insearch.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { compileQuery, findMatches, findBlocksMatching } from "../insearch";
import type { Block } from "../types";

describe("compileQuery", () => {
  it("returns a case-insensitive regex for an all-lowercase pattern", () => {
    const re = compileQuery("hello");
    expect(re).not.toBeNull();
    expect(re!.flags).toContain("i");
    expect(re!.test("HELLO")).toBe(true);
  });

  it("returns a case-sensitive regex when the pattern has uppercase", () => {
    const re = compileQuery("Hello");
    expect(re).not.toBeNull();
    expect(re!.flags).not.toContain("i");
    expect(re!.test("hello")).toBe(false);
    expect(re!.test("Hello")).toBe(true);
  });

  it("returns null for an invalid regex pattern", () => {
    expect(compileQuery("[invalid")).toBeNull();
  });

  it("returns a global regex", () => {
    const re = compileQuery("x");
    expect(re!.flags).toContain("g");
  });
});

describe("findMatches", () => {
  it("returns empty array when nothing matches", () => {
    const lines = [
      { text: "You", blockIndex: 0 },
      { text: "  hello world", blockIndex: 0 },
    ] as any;
    const re = compileQuery("xyz")!;
    expect(findMatches(lines, re)).toEqual([]);
  });

  it("returns a match with correct lineIndex, col, and length", () => {
    const lines = [
      { text: "You", blockIndex: 0 },
      { text: "  hello world", blockIndex: 0 },
    ] as any;
    const re = compileQuery("hello")!;
    const matches = findMatches(lines, re);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({ lineIndex: 1, blockIndex: 0, col: 2, length: 5 });
  });

  it("returns multiple matches across lines in document order", () => {
    const lines = [
      { text: "foo bar", blockIndex: 0 },
      { text: "foo baz", blockIndex: 1 },
    ] as any;
    const re = compileQuery("foo")!;
    const matches = findMatches(lines, re);
    expect(matches).toHaveLength(2);
    expect(matches[0].lineIndex).toBe(0);
    expect(matches[1].lineIndex).toBe(1);
  });

  it("returns multiple matches on the same line", () => {
    const lines = [{ text: "abab", blockIndex: 0 }] as any;
    const re = compileQuery("ab")!;
    const matches = findMatches(lines, re);
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ col: 0, length: 2 });
    expect(matches[1]).toMatchObject({ col: 2, length: 2 });
  });
});

describe("findBlocksMatching", () => {
  it("returns the set of block indices containing a match", () => {
    const blocks: Block[] = [
      { kind: "user", text: "hello world" },
      { kind: "assistant", text: "no match here" },
      { kind: "user", text: "hello again" },
    ];
    const re = compileQuery("hello")!;
    const result = findBlocksMatching(blocks, 80, re);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
  });

  it("finds matches inside collapsed block content (thinking block)", () => {
    const blocks: Block[] = [
      { kind: "thinking", text: "secret keyword here" },
    ];
    const re = compileQuery("keyword")!;
    const result = findBlocksMatching(blocks, 80, re);
    expect(result.has(0)).toBe(true);
  });

  it("returns an empty set when nothing matches", () => {
    const blocks: Block[] = [
      { kind: "user", text: "no match" },
    ];
    const re = compileQuery("xyz")!;
    expect(findBlocksMatching(blocks, 80, re).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/jchan/git/claude-sessions && bun test src/__tests__/insearch.test.ts
```

Expected: error — module `../insearch` not found.

- [ ] **Step 3: Implement `src/insearch.ts`**

```typescript
// src/insearch.ts
import { blocksToLines } from "./render";
import type { Block } from "./types";
import type { Line } from "./render";

export interface Match {
  lineIndex: number;
  blockIndex: number;
  col: number;
  length: number;
}

export function compileQuery(pattern: string): RegExp | null {
  try {
    const flags = /[A-Z]/.test(pattern) ? "g" : "gi";
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

export function findMatches(lines: Line[], regex: RegExp): Match[] {
  const matches: Match[] = [];
  // Reset lastIndex before scanning (regex is global/stateful).
  for (let i = 0; i < lines.length; i++) {
    regex.lastIndex = 0;
    const text = lines[i].text;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      matches.push({
        lineIndex: i,
        blockIndex: lines[i].blockIndex,
        col: m.index,
        length: m[0].length,
      });
      // Guard against zero-length matches causing infinite loops.
      if (m[0].length === 0) regex.lastIndex++;
    }
  }
  return matches;
}

export function findBlocksMatching(blocks: Block[], width: number, regex: RegExp): Set<number> {
  // Flatten with all blocks expanded so hidden (collapsed) content is searched.
  const allExpanded = new Set(blocks.map((_, i) => i));
  const { lines } = blocksToLines(blocks, width, allExpanded);
  const matches = findMatches(lines, regex);
  return new Set(matches.map((m) => m.blockIndex));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test src/__tests__/insearch.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/insearch.ts src/__tests__/insearch.test.ts
git commit -m "feat: add insearch pure module (compileQuery, findMatches, findBlocksMatching)"
```

---

## Task 2: `computeScrollTo` + `jumpTo` in `src/nav.ts`

**Files:**
- Modify: `src/nav.ts`
- Modify: `src/__tests__/nav.test.ts`

**Interfaces:**
- Consumes: existing `useBlockNav` signature; existing `NavAction` type.
- Produces:
  - `computeScrollTo(lineIndex: number, visibleRows: number, totalLines: number): number` — exported pure function
  - `useBlockNav` return type gains `jumpTo: (lineIndex: number, blockIndex: number) => void`

- [ ] **Step 1: Write the failing tests**

Append to the bottom of `src/__tests__/nav.test.ts`:

```typescript
import { computeScrollTo } from "../nav";

describe("computeScrollTo", () => {
  it("centers the target line in the viewport", () => {
    // lineIndex=10, visibleRows=5 → center offset = 10 - floor(5/2) = 8
    expect(computeScrollTo(10, 5, 20)).toBe(8);
  });

  it("clamps to 0 when line is near the top", () => {
    expect(computeScrollTo(1, 5, 20)).toBe(0);
  });

  it("clamps to maxOffset at the bottom", () => {
    // maxOffset = 20 - 5 = 15; line 18 would center at 16 > 15 → clamp to 15
    expect(computeScrollTo(18, 5, 20)).toBe(15);
  });

  it("returns 0 when totalLines <= visibleRows", () => {
    expect(computeScrollTo(2, 5, 4)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test src/__tests__/nav.test.ts
```

Expected: FAIL — `computeScrollTo` is not exported from `../nav`.

- [ ] **Step 3: Add `computeScrollTo` to `src/nav.ts`**

Add this exported function after the existing `computeBlockScroll` function (before `useBlockNav`):

```typescript
export function computeScrollTo(
  lineIndex: number,
  visibleRows: number,
  totalLines: number
): number {
  const maxOffset = Math.max(0, totalLines - visibleRows);
  const ideal = lineIndex - Math.floor(visibleRows / 2);
  return Math.max(0, Math.min(ideal, maxOffset));
}
```

- [ ] **Step 4: Add `jumpTo` to `useBlockNav`**

In `src/nav.ts`, change the return type and add `jumpTo` inside `useBlockNav`.

Find the `reset` line near the end of `useBlockNav` (currently: `const reset = () => setState({ cursor: 0, offset: 0 });`) and replace the whole return with:

```typescript
  const reset = () => setState({ cursor: 0, offset: 0 });
  const jumpTo = (lineIndex: number, blockIndex: number) => {
    setState((prev) => ({
      cursor: Math.max(0, Math.min(blockIndex, ranges.length - 1)),
      offset: computeScrollTo(lineIndex, visibleRows, totalLines),
    }));
  };
  return { cursor: state.cursor, offset: state.offset, reset, jumpTo };
```

Update the return type annotation at the top of `useBlockNav` from:
```typescript
): { cursor: number; offset: number; reset: () => void } {
```
to:
```typescript
): { cursor: number; offset: number; reset: () => void; jumpTo: (lineIndex: number, blockIndex: number) => void } {
```

- [ ] **Step 5: Run all tests to verify nothing broke**

```bash
bun test
```

Expected: all existing tests pass plus the 4 new `computeScrollTo` tests.

- [ ] **Step 6: Commit**

```bash
git add src/nav.ts src/__tests__/nav.test.ts
git commit -m "feat: add computeScrollTo and jumpTo to useBlockNav"
```

---

## Task 3: `DetailSearchBar` component

**Files:**
- Create: `src/components/DetailSearchBar.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (standalone input component).
- Produces:
  ```typescript
  interface DetailSearchBarProps {
    query: string;
    focused: boolean;
    error: string | null;
    onChange: (q: string) => void;
    onSubmit: (q: string) => void;
    onCancel: () => void; // Esc — closes prompt without clearing active search
  }
  export function DetailSearchBar(props: DetailSearchBarProps): JSX.Element
  ```

- [ ] **Step 1: Create `src/components/DetailSearchBar.tsx`**

```typescript
// src/components/DetailSearchBar.tsx
import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";

interface Props {
  query: string;
  focused: boolean;
  error: string | null;
  onChange: (q: string) => void;
  onSubmit: (q: string) => void;
  onCancel: () => void;
}

export function DetailSearchBar({ query, focused, error, onChange, onSubmit, onCancel }: Props) {
  const [cursor, setCursor] = useState(query.length);

  useEffect(() => {
    setCursor((c) => Math.min(c, query.length));
  }, [query.length]);

  useInput(
    (input, key) => {
      if (key.escape) { onCancel(); return; }
      if (key.return) { onSubmit(query); return; }

      if (key.leftArrow)  { setCursor((c) => Math.max(0, c - 1)); return; }
      if (key.rightArrow) { setCursor((c) => Math.min(query.length, c + 1)); return; }

      if (key.ctrl) {
        if (input === "a") { setCursor(0); return; }
        if (input === "e") { setCursor(query.length); return; }
        if (input === "u") { onChange(query.slice(cursor)); setCursor(0); return; }
        if (input === "l") { onChange(""); setCursor(0); return; }
        return;
      }

      if (key.backspace || key.delete) {
        if (cursor > 0) {
          onChange(query.slice(0, cursor - 1) + query.slice(cursor));
          setCursor(cursor - 1);
        }
        return;
      }

      if (!key.meta && input) {
        onChange(query.slice(0, cursor) + input + query.slice(cursor));
        setCursor(cursor + input.length);
      }
    },
    { isActive: focused }
  );

  const before = query.slice(0, cursor);
  const atCursor = query[cursor] ?? "";
  const after = query.slice(cursor + 1);

  return (
    <Box paddingX={1}>
      <Text color="cyan">{"/ "}</Text>
      {query === "" && !error ? (
        <Text dimColor>Search in session…</Text>
      ) : (
        <>
          <Text>{before}</Text>
          <Text backgroundColor="gray" color="black">{atCursor || " "}</Text>
          <Text>{after}</Text>
        </>
      )}
      {error && <Text color="red">{" " + error}</Text>}
    </Box>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/jchan/git/claude-sessions && bun run build 2>&1 | head -20
```

Expected: no TypeScript errors involving `DetailSearchBar`.

- [ ] **Step 3: Commit**

```bash
git add src/components/DetailSearchBar.tsx
git commit -m "feat: add DetailSearchBar component (bottom vim-style search prompt)"
```

---

## Task 4: Update `SessionDetail` to render match highlight

**Files:**
- Modify: `src/components/SessionDetail.tsx`

**Interfaces:**
- Consumes: `Match` type from `src/insearch.ts` (only `{ lineIndex, col, length }`).
- Produces: `SessionDetail` accepts two new optional props:
  ```typescript
  currentMatch: { lineIndex: number; col: number; length: number } | null
  matchInfo: { index: number; total: number } | null
  matchError: string | null
  ```

- [ ] **Step 1: Read the current file** (already read above — content is current)

- [ ] **Step 2: Update `src/components/SessionDetail.tsx`**

Replace the entire file content:

```typescript
// src/components/SessionDetail.tsx
import React from "react";
import { Box, Text } from "ink";
import { relativeTime } from "../utils";
import { scrollbar } from "../scrollbar";
import type { Session } from "../types";
import type { Line } from "../render";

interface Props {
  session: Session | null;
  lines: Line[];
  turnCount: number;
  scrollOffset: number;
  visibleRows: number;
  focused: boolean;
  cursor: number;
  currentMatch: { lineIndex: number; col: number; length: number } | null;
  matchInfo: { index: number; total: number } | null;
  matchError: string | null;
}

export function SessionDetail({
  session,
  lines,
  turnCount,
  scrollOffset,
  visibleRows,
  focused,
  cursor,
  currentMatch,
  matchInfo,
  matchError,
}: Props) {
  if (!session) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text dimColor>Press Enter on a session to view it</Text>
      </Box>
    );
  }

  const visible = lines.slice(scrollOffset, scrollOffset + visibleRows);
  const bar = scrollbar(scrollOffset, lines.length, visibleRows);
  const maxOffset = Math.max(0, lines.length - visibleRows);
  const scrollable = lines.length > visibleRows;
  const pct = maxOffset === 0 ? 100 : Math.round((scrollOffset / maxOffset) * 100);

  const matchStatus = matchError
    ? <Text color="red"> · {matchError}</Text>
    : matchInfo
      ? matchInfo.total === 0
        ? <Text dimColor> · no matches</Text>
        : <Text dimColor> · {matchInfo.index + 1}/{matchInfo.total}</Text>
      : null;

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box>
        <Text bold color={focused ? "cyan" : undefined}>
          {session.projectPath}
        </Text>
        {matchStatus}
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>
          {relativeTime(session.updatedAt)} · {turnCount} {turnCount === 1 ? "turn" : "turns"}
          {scrollable ? ` · ${pct}%` : ""}
        </Text>
      </Box>
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" flexGrow={1}>
          {visible.map((ln, i) => {
            const absoluteLineIndex = scrollOffset + i;
            const isLineFocused = ln.blockIndex === cursor;
            const isMatchLine =
              currentMatch !== null && absoluteLineIndex === currentMatch.lineIndex;

            return (
              <Box key={absoluteLineIndex}>
                <Text color={isLineFocused ? "cyan" : ln.accent} dimColor={!isLineFocused}>
                  {isLineFocused ? "▌" : ln.accent ? "│" : " "}
                </Text>
                {isMatchLine ? (
                  <>
                    <Text color={ln.color} bold={ln.bold} dimColor={ln.dim} wrap="truncate">
                      {ln.text.slice(0, currentMatch.col)}
                    </Text>
                    <Text
                      backgroundColor="yellow"
                      color="black"
                      bold
                      wrap="truncate"
                    >
                      {ln.text.slice(currentMatch.col, currentMatch.col + currentMatch.length)}
                    </Text>
                    <Text color={ln.color} bold={ln.bold} dimColor={ln.dim} wrap="truncate">
                      {ln.text.slice(currentMatch.col + currentMatch.length)}
                    </Text>
                  </>
                ) : (
                  <Text color={ln.color} bold={ln.bold} dimColor={ln.dim} wrap="truncate">
                    {ln.text === "" ? " " : ln.text}
                  </Text>
                )}
                {isLineFocused && ln.hint ? <Text dimColor>{"   "}{ln.hint}</Text> : null}
              </Box>
            );
          })}
        </Box>
        <Box flexDirection="column" width={1}>
          {bar.map((c, i) => (
            <Text key={i} dimColor>{c}</Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 3: Verify the build still compiles (App.tsx will have type errors from the new required props — fix those now)**

`App.tsx` currently renders `<SessionDetail ... />` without the new props. Add them as `null` / `null` / `null` temporarily to satisfy the type checker while the full wiring comes in Task 5:

In `src/components/App.tsx`, find the `<SessionDetail` JSX block and add three props:

```tsx
<SessionDetail
  session={selectedSession}
  lines={lines}
  turnCount={turnCount}
  scrollOffset={detailScroll}
  visibleRows={detailVisibleRows}
  focused={detailFocused}
  cursor={detailCursor}
  currentMatch={null}
  matchInfo={null}
  matchError={null}
/>
```

- [ ] **Step 4: Confirm build passes**

```bash
bun run build 2>&1 | tail -5
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/SessionDetail.tsx src/components/App.tsx
git commit -m "feat: add match highlight to SessionDetail (currentMatch, matchInfo, matchError props)"
```

---

## Task 5: Update `StatusBar` and wire everything in `App.tsx`

This is the final task — it adds the state machine, key handlers, and connects all prior tasks.

**Files:**
- Modify: `src/components/StatusBar.tsx`
- Modify: `src/components/App.tsx`

**Interfaces:**
- Consumes:
  - `compileQuery`, `findMatches`, `findBlocksMatching`, `Match` from `src/insearch.ts`
  - `DetailSearchBar` from `src/components/DetailSearchBar.tsx`
  - `computeScrollTo` (indirectly via `jumpTo`) from `src/nav.ts`
  - `SessionDetail` new props: `currentMatch`, `matchInfo`, `matchError`

- [ ] **Step 1: Update `src/components/StatusBar.tsx`**

Replace the `hint` for `focus === "detail"`:

```typescript
// src/components/StatusBar.tsx
import React from "react";
import { Box, Text } from "ink";

interface Props {
  focus?: "list" | "detail";
  hasDetail?: boolean;
}

export function StatusBar({ focus = "list", hasDetail = false }: Props) {
  const hint =
    focus === "detail"
      ? "j/k scroll · Ctrl-d/u page · g/G top/bottom · Ctrl+o expand · / search · n/N next/prev · r resume · Esc back · q quit"
      : hasDetail
        ? "j/k navigate · / search · enter view · r resume · ? help · q quit"
        : "j/k navigate · / search · enter view · ? help · q quit";

  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      <Text dimColor>{hint}</Text>
    </Box>
  );
}
```

- [ ] **Step 2: Add detail-search state and derived values to `App.tsx`**

In `src/components/App.tsx`, add these imports at the top:

```typescript
import { compileQuery, findMatches, findBlocksMatching } from "../insearch";
import type { Match } from "../insearch";
import { DetailSearchBar } from "./DetailSearchBar";
```

Inside the `App` component body, after the existing state declarations (after `helpOpenRef.current = helpOpen;`), add:

```typescript
  // Detail-pane (in-session) search state
  const [dQuery, setDQuery] = useState("");
  const [dPattern, setDPattern] = useState<string | null>(null);
  const [dFocused, setDFocused] = useState(false);
  const [dMatchIdx, setDMatchIdx] = useState(0);
  const [dError, setDError] = useState<string | null>(null);
```

- [ ] **Step 3: Add derived `matches` and `jumpTo` effect**

After the existing `const detailFocused = focus === "detail";` line, add:

```typescript
  // Derive matches from active pattern + currently rendered lines.
  const dRegex = useMemo(
    () => (dPattern ? compileQuery(dPattern) : null),
    [dPattern]
  );
  const matches: Match[] = useMemo(
    () => (dRegex ? findMatches(lines, dRegex) : []),
    [lines, dRegex]
  );

  // Clamp matchIdx when matches shrinks (expand/collapse/resize reflow).
  useEffect(() => {
    if (matches.length > 0) {
      setDMatchIdx((prev) => Math.min(prev, matches.length - 1));
    }
  }, [matches.length]);
```

- [ ] **Step 4: Update `useBlockNav` call for detail to capture `jumpTo`**

Find the existing line:
```typescript
  const { cursor: detailCursor, offset: detailScroll, reset: resetDetailScroll } = useBlockNav(
```

Replace with:
```typescript
  const { cursor: detailCursor, offset: detailScroll, reset: resetDetailScroll, jumpTo: jumpToDetail } = useBlockNav(
```

Also update the `enabled` flag of this `useBlockNav` call to gate on `dFocused`:

```typescript
  const { cursor: detailCursor, offset: detailScroll, reset: resetDetailScroll, jumpTo: jumpToDetail } = useBlockNav(
    ranges,
    lines.length,
    detailVisibleRows,
    !searchFocused && !dFocused && detailFocused
  );
```

- [ ] **Step 5: Add jump effect**

After the clamp effect, add:

```typescript
  // Jump to the current match whenever matchIdx or matches change.
  useEffect(() => {
    if (matches.length > 0 && dPattern) {
      const m = matches[dMatchIdx];
      jumpToDetail(m.lineIndex, m.blockIndex);
    }
  }, [dMatchIdx, matches]);
```

- [ ] **Step 6: Add detail-search reset on session change**

Find the existing `useEffect` that resets on `matchedIds`:
```typescript
  useEffect(() => {
    resetList();
    setFocus("list");
    setSelectedSession(null);
    setBlocks([]);
    setExpanded(new Set());
  }, [matchedIds]);
```

Add a separate effect to reset detail-search when the selected session changes:

```typescript
  useEffect(() => {
    setDQuery("");
    setDPattern(null);
    setDFocused(false);
    setDMatchIdx(0);
    setDError(null);
  }, [selectedSession?.id]);
```

- [ ] **Step 7: Add `handleDetailSearchSubmit` handler**

After `handleSearchSubmit`, add:

```typescript
  const handleDetailSearchSubmit = (q: string) => {
    setDFocused(false);
    if (!q.trim()) {
      setDPattern(null);
      setDError(null);
      return;
    }
    const re = compileQuery(q);
    if (!re) {
      setDError("invalid regex");
      setDFocused(true); // keep prompt open
      return;
    }
    // Auto-expand all blocks that contain matches.
    const matchingBlocks = findBlocksMatching(blocks, detailWidth, re);
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const idx of matchingBlocks) next.add(idx);
      return next;
    });
    setDPattern(q);
    setDMatchIdx(0);
    setDError(null);
  };
```

- [ ] **Step 8: Update key handlers**

Find the `useInput` action handler (the one with `isActive: !searchFocused && !helpOpen`). Update its `isActive` to also gate on `dFocused`:

```typescript
  useInput(
    (input, key) => {
      // ... existing body unchanged ...
    },
    { isActive: !searchFocused && !helpOpen && !dFocused }
  );
```

Inside that same handler, update the `/` case and add `n`/`N` and updated `Esc`:

Find this existing block:
```typescript
      if (input === "/") {
        if (focus === "list") setSearchFocused(true);
        return;
      }
```

Replace with:
```typescript
      if (input === "/") {
        if (focus === "list") setSearchFocused(true);
        else if (focus === "detail") setDFocused(true);
        return;
      }
      if (input === "n" && detailFocused && dPattern) {
        setDMatchIdx((prev) => (matches.length === 0 ? 0 : (prev + 1) % matches.length));
        return;
      }
      if (input === "N" && detailFocused && dPattern) {
        setDMatchIdx((prev) => (matches.length === 0 ? 0 : (prev - 1 + matches.length) % matches.length));
        return;
      }
```

Find the existing `Esc` block:
```typescript
      if (key.escape) {
        if (detailFocused) setFocus("list");
        return;
      }
```

Replace with:
```typescript
      if (key.escape) {
        if (detailFocused) {
          if (dPattern) {
            // First Esc clears in-session search; second Esc returns to list.
            setDPattern(null);
            setDQuery("");
            setDError(null);
          } else {
            setFocus("list");
          }
        }
        return;
      }
```

- [ ] **Step 9: Derive `currentMatch` and `matchInfo` for `SessionDetail`**

After the jump effect, add:

```typescript
  const currentMatch = matches.length > 0 ? matches[dMatchIdx] : null;
  const matchInfo =
    dPattern
      ? { index: dMatchIdx, total: matches.length }
      : null;
```

- [ ] **Step 10: Wire `DetailSearchBar` into the JSX**

In the render return, find the `{/* Status bar */}` section. Add `DetailSearchBar` immediately above it:

```tsx
          {/* Detail search prompt — shown only while dFocused */}
          {dFocused && (
            <DetailSearchBar
              query={dQuery}
              focused={dFocused}
              error={dError}
              onChange={setDQuery}
              onSubmit={handleDetailSearchSubmit}
              onCancel={() => setDFocused(false)}
            />
          )}

          {/* Status bar */}
          <StatusBar focus={focus} hasDetail={showDetail && selectedSession !== null} />
```

- [ ] **Step 11: Pass `currentMatch`, `matchInfo`, `matchError` to `SessionDetail`**

Update the `<SessionDetail` block (currently has `currentMatch={null}` etc. from Task 4):

```tsx
<SessionDetail
  session={selectedSession}
  lines={lines}
  turnCount={turnCount}
  scrollOffset={detailScroll}
  visibleRows={detailVisibleRows}
  focused={detailFocused}
  cursor={detailCursor}
  currentMatch={currentMatch}
  matchInfo={matchInfo}
  matchError={dError}
/>
```

- [ ] **Step 12: Run all tests**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 13: Build**

```bash
bun run build 2>&1 | tail -5
```

Expected: binary built successfully, no errors.

- [ ] **Step 14: Commit**

```bash
git add src/components/StatusBar.tsx src/components/App.tsx
git commit -m "feat: wire in-session search — bottom prompt, n/N cycling, auto-expand, match highlight"
```

---

## Self-Review Checklist

**Spec coverage:**

| Spec requirement | Task covering it |
|---|---|
| `/` in detail opens bottom prompt | Task 5 step 8 |
| Smart-case regex | Task 1 (`compileQuery`) |
| Enter runs search, auto-expands, jumps to first match | Task 5 step 7 |
| Only current match highlighted | Task 4 (`currentMatch` prop) |
| `n`/`N` cycle with wraparound | Task 5 step 8 |
| `Esc` (prompt open) cancels prompt, keeps active search | Task 3 (`onCancel`) |
| `Esc` (no prompt, search active) clears search | Task 5 step 8 |
| `Esc` (no prompt, no search) returns to list | Task 5 step 8 |
| Empty query clears search | Task 5 step 7 |
| Match position `3/12` / `no matches` / `invalid regex` | Task 4 + Task 5 |
| Detail `useBlockNav` gated on `dFocused` | Task 5 step 4 |
| Action handler gated on `dFocused` | Task 5 step 8 |
| Reset on session change | Task 5 step 6 |
| `computeScrollTo` + `jumpTo` | Task 2 |
| StatusBar hint updated | Task 5 step 1 |
| Tests for `compileQuery`, `findMatches`, `findBlocksMatching` | Task 1 |
| Tests for `computeScrollTo` | Task 2 |

All spec requirements covered. No placeholders. Type names consistent throughout (`Match`, `dMatchIdx`, `jumpTo`, `currentMatch`).
