# TUI Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the visual design of the claude-sessions TUI — a distinct search bar, a denser/grouped session list, a clearer detail pane (accent bars, scrollbar, focus border), and a richer header.

**Architecture:** Keep the codebase's existing discipline: all layout/derivation logic lives in pure, tested functions (`render.ts`, new `listrender.ts`, `searchbar.ts`, `scrollbar.ts`, `utils.ts`); React leaf components stay presentational and are verified visually. The session list is converted from the fixed-height `SessionItem` model to the same row/range model the detail pane already uses (`computeBlockScroll` / `useBlockNav`), which is what makes variable-height date-group headers and a 2-row compact item possible without bespoke scroll math.

**Tech Stack:** Bun, React, Ink, TypeScript. Tests via `bun test`. Build via `bun run build`. Manual UI check via `bun run dev`.

## Global Constraints

- Runtime is **Bun**, not Node. macOS/arm64 only.
- Keep parsing/navigation/render logic in **pure functions**; add tests under `src/__tests__/`. Do **not** write tests for React components — verify those visually with `bun run dev`.
- `useInput` handlers must stay mutually exclusive via their `isActive`/`enabled` flag.
- One responsibility per file; follow existing file patterns (e.g. `render.ts` shows the pure-builder + `Line[]`/`ranges` pattern to mirror).
- After every task: `bun test` must pass and `bun run build` must typecheck clean.
- Commit after each task with a `feat:`/`refactor:`/`test:` prefixed message.

---

## File Structure

- **Create** `src/searchbar.ts` — pure view-state for the search bar (border color, placeholder, status chip).
- **Create** `src/listrender.ts` — pure `dateBucket` + `sessionsToRows` builder producing `ListRow[]` + `ranges` (mirrors `render.ts`).
- **Create** `src/scrollbar.ts` — pure `scrollbar()` producing one glyph per visible row.
- **Modify** `src/utils.ts` — add `truncateEnd`, `headerSummary`.
- **Modify** `src/render.ts` — add an `accent` color to every `Line`.
- **Modify** `src/components/SearchBar.tsx` — bordered, focus-colored, placeholder + count chip.
- **Modify** `src/components/SessionList.tsx` — render the new row model with full-width selection highlight + group headers.
- **Modify** `src/components/SessionDetail.tsx` — accent gutter, scrollbar column, metadata cleanup.
- **Modify** `src/components/StatusBar.tsx` — absorb the detail-pane key hints.
- **Modify** `src/components/App.tsx` — wire row-model list nav, header summary, focus-colored divider.
- **Delete** `src/components/SessionItem.tsx` — replaced by the row model.

---

### Task 1: Search bar redesign

Make the search bar a distinct, stateful widget: a bordered box whose border color tracks focus, a dim placeholder when idle, and a right-aligned match-count chip that stays visible while a filter is active.

**Files:**
- Create: `src/searchbar.ts`
- Create: `src/__tests__/searchbar.test.ts`
- Modify: `src/components/SearchBar.tsx`

**Interfaces:**
- Produces: `searchBarView(p: { query: string; focused: boolean; matchCount: number | null; error: string | null }): SearchBarView` where
  ```ts
  interface SearchBarView {
    borderColor: string;        // "red" | "cyan" | "gray"
    showPlaceholder: boolean;
    status: { text: string; color?: string } | null;
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/searchbar.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { searchBarView } from "../searchbar";

describe("searchBarView", () => {
  it("is gray with a placeholder when idle and empty", () => {
    const v = searchBarView({ query: "", focused: false, matchCount: null, error: null });
    expect(v.borderColor).toBe("gray");
    expect(v.showPlaceholder).toBe(true);
    expect(v.status).toBeNull();
  });

  it("turns cyan and hides the placeholder when focused", () => {
    const v = searchBarView({ query: "kube", focused: true, matchCount: null, error: null });
    expect(v.borderColor).toBe("cyan");
    expect(v.showPlaceholder).toBe(false);
  });

  it("stays cyan with a chip while a filter is active but unfocused", () => {
    const v = searchBarView({ query: "kube", focused: false, matchCount: 3, error: null });
    expect(v.borderColor).toBe("cyan");
    expect(v.showPlaceholder).toBe(false);
    expect(v.status).toEqual({ text: "3 matches", color: "cyan" });
  });

  it("uses singular for one match", () => {
    const v = searchBarView({ query: "x", focused: true, matchCount: 1, error: null });
    expect(v.status).toEqual({ text: "1 match", color: "cyan" });
  });

  it("shows the error in red and takes precedence", () => {
    const v = searchBarView({ query: "x", focused: true, matchCount: null, error: "ripgrep not found" });
    expect(v.borderColor).toBe("red");
    expect(v.status).toEqual({ text: "ripgrep not found", color: "red" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/searchbar.test.ts`
Expected: FAIL — `Cannot find module '../searchbar'`.

- [ ] **Step 3: Write the implementation**

Create `src/searchbar.ts`:

```ts
// src/searchbar.ts
// Pure view-state for the search bar so the component stays presentational.

export interface SearchBarView {
  borderColor: string; // "red" on error, "cyan" when focused or filtering, else "gray"
  showPlaceholder: boolean;
  status: { text: string; color?: string } | null;
}

export function searchBarView(p: {
  query: string;
  focused: boolean;
  matchCount: number | null;
  error: string | null;
}): SearchBarView {
  const filtering = p.matchCount !== null;
  const borderColor = p.error ? "red" : p.focused || filtering ? "cyan" : "gray";
  const showPlaceholder = !p.focused && !filtering && p.query === "" && !p.error;

  let status: SearchBarView["status"] = null;
  if (p.error) {
    status = { text: p.error, color: "red" };
  } else if (p.matchCount !== null) {
    status = {
      text: `${p.matchCount} ${p.matchCount === 1 ? "match" : "matches"}`,
      color: "cyan",
    };
  }

  return { borderColor, showPlaceholder, status };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/searchbar.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Rewrite the component to use it**

Replace `src/components/SearchBar.tsx` with:

```tsx
// src/components/SearchBar.tsx
import React from "react";
import { Box, Text, useInput } from "ink";
import { searchBarView } from "../searchbar";

interface Props {
  query: string;
  focused: boolean;
  onChange: (q: string) => void;
  onSubmit: (q: string) => void;
  onExit: () => void;
  matchCount: number | null;
  error: string | null;
}

export function SearchBar({
  query,
  focused,
  onChange,
  onSubmit,
  onExit,
  matchCount,
  error,
}: Props) {
  useInput(
    (input, key) => {
      if (key.escape) { onExit(); return; }
      if (key.backspace || key.delete) { onChange(query.slice(0, -1)); return; }
      if (key.return) { onSubmit(query); return; }
      if (!key.ctrl && !key.meta && input) onChange(query + input);
    },
    { isActive: focused }
  );

  const view = searchBarView({ query, focused, matchCount, error });

  return (
    <Box
      borderStyle="round"
      borderColor={view.borderColor}
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text color={focused ? "cyan" : "gray"}>{"🔍 "}</Text>
        {view.showPlaceholder ? (
          <Text dimColor>Search transcripts  (press /)</Text>
        ) : (
          <Text>{query}</Text>
        )}
        {focused && <Text color="gray">{"█"}</Text>}
      </Box>
      {view.status && <Text color={view.status.color}>{view.status.text}</Text>}
    </Box>
  );
}
```

- [ ] **Step 6: Verify the full suite and build**

Run: `bun test`
Expected: PASS (51 tests).
Run: `bun run build`
Expected: build succeeds, no type errors.

- [ ] **Step 7: Visual check**

Run: `bun run dev`. Confirm: idle bar shows a gray rounded box with the magnifier + dim placeholder; pressing `/` turns the border cyan and shows a cursor; after a search the border stays cyan with an `N matches` chip on the right; a bad search (rename `rg` or trigger an error) shows red.

- [ ] **Step 8: Commit**

```bash
git add src/searchbar.ts src/__tests__/searchbar.test.ts src/components/SearchBar.tsx
git commit -m "feat: make the search bar a distinct bordered widget"
```

---

### Task 2: List row model (pure)

Introduce the pure builder that turns sessions into renderable rows with date-group headers and a compact 2-line layout (name + right-aligned time, then summary). This is the foundation the list component and nav are rebuilt on in Task 3.

**Files:**
- Modify: `src/utils.ts`
- Create: `src/listrender.ts`
- Create: `src/__tests__/listrender.test.ts`
- Modify: `src/__tests__/sessions.test.ts` is **not** touched; add util tests inline below.
- Create: `src/__tests__/utils.test.ts`

**Interfaces:**
- Produces: `truncateEnd(s: string, n: number): string` in `utils.ts`.
- Produces: `dateBucket(date: Date, now: Date): string` → one of `"Today" | "Yesterday" | "This week" | "Older"`.
- Produces:
  ```ts
  type ListRow =
    | { kind: "header"; text: string }
    | { kind: "item-name"; sessionIndex: number; text: string }
    | { kind: "item-summary"; sessionIndex: number; text: string };

  function sessionsToRows(
    sessions: Session[],
    width: number,
    now?: Date
  ): { rows: ListRow[]; ranges: { start: number; len: number }[] };
  ```
  Each `ranges[i]` covers session `i`'s rows, **including** any group header that immediately precedes it (so the header scrolls in with its first item). Item line `text` is padded to `width - 4` columns (2 for the component's `paddingX`, 2 for the selection gutter) so the selection highlight spans the full inner width.

- [ ] **Step 1: Write the failing util test**

Create `src/__tests__/utils.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { truncateEnd, headerSummary } from "../utils";

describe("truncateEnd", () => {
  it("returns the string unchanged when it fits", () => {
    expect(truncateEnd("hello", 10)).toBe("hello");
  });
  it("truncates with an ellipsis when too long", () => {
    expect(truncateEnd("hello world", 5)).toBe("hell…");
  });
  it("returns empty for non-positive width", () => {
    expect(truncateEnd("hello", 0)).toBe("");
  });
});

describe("headerSummary", () => {
  it("counts sessions when unfiltered", () => {
    expect(headerSummary(42, null, "")).toBe("42 sessions");
  });
  it("uses singular for one session", () => {
    expect(headerSummary(1, null, "")).toBe("1 session");
  });
  it("shows the active filter and ratio", () => {
    expect(headerSummary(42, 3, "kube")).toBe('3 of 42 · filter: "kube"');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test src/__tests__/utils.test.ts`
Expected: FAIL — `truncateEnd`/`headerSummary` not exported.

- [ ] **Step 3: Add the utils**

Append to `src/utils.ts`:

```ts
export function truncateEnd(s: string, n: number): string {
  if (n <= 0) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function headerSummary(total: number, matchCount: number | null, query: string): string {
  if (matchCount !== null) return `${matchCount} of ${total} · filter: "${query}"`;
  return `${total} ${total === 1 ? "session" : "sessions"}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `bun test src/__tests__/utils.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing listrender test**

Create `src/__tests__/listrender.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { dateBucket, sessionsToRows } from "../listrender";
import type { Session } from "../types";

const NOW = new Date("2026-06-24T12:00:00Z");

function mkSession(id: string, name: string, summary: string, updatedAt: Date): Session {
  return {
    id,
    projectPath: "/p/" + name,
    projectName: name,
    startedAt: updatedAt,
    updatedAt,
    summary,
    turnCount: 0,
    filePath: "/p/" + id + ".jsonl",
  };
}

describe("dateBucket", () => {
  it("labels same-day as Today", () => {
    expect(dateBucket(new Date("2026-06-24T01:00:00Z"), NOW)).toBe("Today");
  });
  it("labels the previous day as Yesterday", () => {
    expect(dateBucket(new Date("2026-06-23T23:00:00Z"), NOW)).toBe("Yesterday");
  });
  it("labels within a week as This week", () => {
    expect(dateBucket(new Date("2026-06-20T12:00:00Z"), NOW)).toBe("This week");
  });
  it("labels older than a week as Older", () => {
    expect(dateBucket(new Date("2026-06-01T12:00:00Z"), NOW)).toBe("Older");
  });
});

describe("sessionsToRows", () => {
  it("emits a header before the first item of each date group", () => {
    const sessions = [
      mkSession("a", "alpha", "first", new Date("2026-06-24T11:00:00Z")),
      mkSession("b", "bravo", "second", new Date("2026-06-24T10:00:00Z")),
      mkSession("c", "charlie", "third", new Date("2026-06-23T10:00:00Z")),
    ];
    const { rows } = sessionsToRows(sessions, 35, NOW);
    expect(rows.filter((r) => r.kind === "header").map((r) => (r as any).text)).toEqual([
      "Today",
      "Yesterday",
    ]);
    // Two content rows (name + summary) per session.
    expect(rows.filter((r) => r.kind === "item-name").length).toBe(3);
    expect(rows.filter((r) => r.kind === "item-summary").length).toBe(3);
  });

  it("ranges include the preceding header and cover both content rows", () => {
    const sessions = [
      mkSession("a", "alpha", "first", new Date("2026-06-24T11:00:00Z")),
      mkSession("b", "bravo", "second", new Date("2026-06-24T10:00:00Z")),
    ];
    const { rows, ranges } = sessionsToRows(sessions, 35, NOW);
    // session 0: header + name + summary = 3 rows; session 1: name + summary = 2 rows.
    expect(ranges).toEqual([
      { start: 0, len: 3 },
      { start: 3, len: 2 },
    ]);
    expect(rows[0]).toEqual({ kind: "header", text: "Today" });
    expect((rows[1] as any).sessionIndex).toBe(0);
    expect((rows[3] as any).sessionIndex).toBe(1);
  });

  it("right-aligns the time and pads lines to width-4", () => {
    const sessions = [mkSession("a", "alpha", "hi", new Date("2026-06-24T11:00:00Z"))];
    const { rows } = sessionsToRows(sessions, 35, NOW);
    const name = rows.find((r) => r.kind === "item-name") as any;
    const summary = rows.find((r) => r.kind === "item-summary") as any;
    expect(name.text.length).toBe(31); // 35 - 4
    expect(summary.text.length).toBe(31);
    expect(name.text.startsWith("alpha")).toBe(true);
    expect(name.text.trimEnd().endsWith("ago")).toBe(true);
    expect(summary.text.startsWith('"hi"')).toBe(true);
  });

  it("truncates a long project name to leave room for the time", () => {
    const sessions = [
      mkSession("a", "this-is-a-very-long-project-name-indeed", "x", new Date("2026-06-24T11:00:00Z")),
    ];
    const { rows } = sessionsToRows(sessions, 35, NOW);
    const name = rows.find((r) => r.kind === "item-name") as any;
    expect(name.text.length).toBe(31);
    expect(name.text).toContain("…");
    expect(name.text.trimEnd().endsWith("ago")).toBe(true);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `bun test src/__tests__/listrender.test.ts`
Expected: FAIL — `Cannot find module '../listrender'`.

- [ ] **Step 7: Implement the builder**

Create `src/listrender.ts`:

```ts
// src/listrender.ts
// Pure builder: flatten sessions into renderable rows with date-group headers
// and per-session ranges, mirroring render.ts's blocksToLines pattern.
import type { Session } from "./types";
import { relativeTime, truncateEnd } from "./utils";

export type ListRow =
  | { kind: "header"; text: string }
  | { kind: "item-name"; sessionIndex: number; text: string }
  | { kind: "item-summary"; sessionIndex: number; text: string };

export function dateBucket(date: Date, now: Date): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.floor((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return "Older";
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

function nameLine(name: string, time: string, cw: number): string {
  if (time.length + 1 >= cw) return pad(truncateEnd(name, cw), cw);
  const n = truncateEnd(name, cw - time.length - 1);
  const gap = cw - n.length - time.length;
  return n + " ".repeat(gap) + time;
}

export function sessionsToRows(
  sessions: Session[],
  width: number,
  now: Date = new Date()
): { rows: ListRow[]; ranges: { start: number; len: number }[] } {
  const rows: ListRow[] = [];
  const ranges: { start: number; len: number }[] = [];
  // width - 2 for the component's paddingX, - 2 for the selection gutter.
  const cw = Math.max(1, width - 4);
  let lastBucket: string | null = null;

  sessions.forEach((s, i) => {
    const start = rows.length;
    const bucket = dateBucket(s.updatedAt, now);
    if (bucket !== lastBucket) {
      rows.push({ kind: "header", text: bucket });
      lastBucket = bucket;
    }
    rows.push({ kind: "item-name", sessionIndex: i, text: nameLine(s.projectName, relativeTime(s.updatedAt), cw) });
    rows.push({ kind: "item-summary", sessionIndex: i, text: pad(truncateEnd(`"${s.summary}"`, cw), cw) });
    ranges.push({ start, len: rows.length - start });
  });

  return { rows, ranges };
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `bun test src/__tests__/listrender.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 9: Full suite + build**

Run: `bun test` → PASS. Run: `bun run build` → clean.

- [ ] **Step 10: Commit**

```bash
git add src/utils.ts src/listrender.ts src/__tests__/utils.test.ts src/__tests__/listrender.test.ts
git commit -m "feat: add pure row model for the session list"
```

---

### Task 3: Rewire the list to the row model

Replace the fixed-height `SessionItem` list with the row model: navigate by session using `useBlockNav` (the same engine the detail pane uses), render a full-width selection highlight, and show date-group headers. Delete `SessionItem.tsx`.

**Files:**
- Modify: `src/components/SessionList.tsx`
- Modify: `src/components/App.tsx`
- Delete: `src/components/SessionItem.tsx`

**Interfaces:**
- Consumes: `sessionsToRows` and `ListRow` from Task 2; `useBlockNav` from `src/nav.ts` (`(ranges, totalLines, visibleRows, enabled) => { cursor, offset, reset }`).
- `SessionList` new props: `{ rows: ListRow[]; cursor: number; scrollOffset: number; visibleRows: number; width: number; dimmed?: boolean }`.

- [ ] **Step 1: Rewrite SessionList**

Replace `src/components/SessionList.tsx` with:

```tsx
// src/components/SessionList.tsx
import React from "react";
import { Box, Text } from "ink";
import type { ListRow } from "../listrender";

interface Props {
  rows: ListRow[];
  cursor: number;
  scrollOffset: number;
  visibleRows: number;
  width: number;
  dimmed?: boolean;
}

export function SessionList({ rows, cursor, scrollOffset, visibleRows, width, dimmed }: Props) {
  const visible = rows.slice(scrollOffset, scrollOffset + visibleRows);
  const highlight = dimmed ? "gray" : "blue";

  return (
    <Box flexDirection="column" width={width} paddingX={1}>
      {visible.map((row, i) => {
        const key = scrollOffset + i;
        if (row.kind === "header") {
          return (
            <Box key={key}>
              <Text dimColor bold>{`── ${row.text} ──`}</Text>
            </Box>
          );
        }
        const selected = row.sessionIndex === cursor;
        const gutter = row.kind === "item-name" && selected ? "› " : "  ";
        return (
          <Box key={key}>
            <Text
              backgroundColor={selected ? highlight : undefined}
              color={selected && !dimmed ? "white" : undefined}
              bold={selected && !dimmed && row.kind === "item-name"}
              dimColor={!selected && row.kind === "item-summary"}
              wrap="truncate"
            >
              {gutter}
              {row.text}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
```

- [ ] **Step 2: Rewire App to the row model**

In `src/components/App.tsx`:

(a) Update imports — drop `useVimNav`, add `sessionsToRows`:

```tsx
import { useBlockNav } from "../nav";
import { blocksToLines } from "../render";
import { sessionsToRows } from "../listrender";
```

(b) Replace the list-geometry + nav block. Remove the old `listVisibleRows`/`itemHeight`/`useVimNav` lines (`App.tsx:73`, `App.tsx:75`, `App.tsx:86-90`) and the `detailWidth` line stays. Insert:

```tsx
  const listPaneWidth = showDetail ? LIST_WIDTH : termCols;
  const listVisibleRows = Math.max(1, termRows - 4);
  const detailVisibleRows = Math.max(1, termRows - 6);
  const detailWidth = Math.max(20, termCols - LIST_WIDTH - 4);

  const { rows: listRows, ranges: listRanges } = useMemo(
    () => sessionsToRows(filteredSessions, listPaneWidth),
    [filteredSessions, listPaneWidth]
  );

  const { cursor: selectedIndex, offset: listScroll, reset: resetList } = useBlockNav(
    listRanges,
    listRows.length,
    listVisibleRows,
    !searchFocused && focus === "list"
  );
```

(c) Replace the `<SessionList .../>` usage (`App.tsx:180-187`) with:

```tsx
        <SessionList
          rows={listRows}
          cursor={selectedIndex}
          scrollOffset={listScroll}
          visibleRows={listVisibleRows}
          width={listPaneWidth}
          dimmed={detailFocused}
        />
```

The Enter handler keeps using `filteredSessions[selectedIndex]` unchanged (`selectedIndex` is now the block cursor). `resetList()` in the `matchedIds` effect is unchanged.

- [ ] **Step 3: Delete the obsolete component**

```bash
git rm src/components/SessionItem.tsx
```

- [ ] **Step 4: Build to verify types**

Run: `bun run build`
Expected: clean. (If `useVimNav` is reported unused anywhere else, it is not — it remains exported in `nav.ts` and is covered by `nav.test.ts`; leave it.)

- [ ] **Step 5: Full suite**

Run: `bun test`
Expected: PASS (existing nav/render/listrender/util/search tests all green).

- [ ] **Step 6: Visual check**

Run: `bun run dev`. Confirm: each session is now 2 lines (name with right-aligned time, then the quoted summary); `── Today ──` / `── Yesterday ──` headers separate date groups; the selected session shows a full-width highlighted block with a `›` on the name line; long project names truncate with `…` instead of wrapping; `j/k`, `g g`, `G`, `Ctrl-d/u` move the selection and scroll correctly; when the detail pane is focused the highlight dims to gray.

- [ ] **Step 7: Commit**

```bash
git add src/components/SessionList.tsx src/components/App.tsx
git commit -m "refactor: render the session list with the row model and date groups"
```

---

### Task 4: Header summary

Surface session count and active-filter state in the header (currently just title + "q to quit", which is redundant with the status bar).

**Files:**
- Modify: `src/components/App.tsx`

**Interfaces:**
- Consumes: `headerSummary(total, matchCount, query)` from Task 2.

- [ ] **Step 1: Import the helper**

In `src/components/App.tsx`, add to the utils import line:

```tsx
import { headerSummary } from "../utils";
```

(If `utils` is not yet imported in App, add `import { headerSummary } from "../utils";` near the other imports.)

- [ ] **Step 2: Replace the header right text**

Replace the header `Box` (`App.tsx:162-165`) with:

```tsx
      {/* Header */}
      <Box paddingX={1} justifyContent="space-between">
        <Text bold color="cyan">Claude Sessions</Text>
        <Text dimColor>
          {headerSummary(sessions.length, matchedIds ? filteredSessions.length : null, query)}
        </Text>
      </Box>
```

- [ ] **Step 3: Build + full suite**

Run: `bun run build` → clean. Run: `bun test` → PASS.

- [ ] **Step 4: Visual check**

Run: `bun run dev`. Header right shows `N sessions`; after a search it shows `3 of N · filter: "query"`.

- [ ] **Step 5: Commit**

```bash
git add src/components/App.tsx
git commit -m "feat: show session count and active filter in the header"
```

---

### Task 5: Detail accent gutter + per-block color

Give every detail line a left accent color keyed to its block kind, and render a continuous colored gutter bar (the focus cursor `▌` still overrides it). This adds visible turn structure to long transcripts.

**Files:**
- Modify: `src/render.ts`
- Modify: `src/__tests__/render.test.ts`
- Modify: `src/components/SessionDetail.tsx`

**Interfaces:**
- Produces: `Line` gains `accent?: string`. Accent values: `user` → `"green"`, `assistant` → `"blue"`, `thinking` → `"gray"`, tool → `"cyan"`, `Task` tool → `"magenta"`. Every line of a block (including its trailing blank separator) carries that block's accent.

- [ ] **Step 1: Update the failing exact-match test**

In `src/__tests__/render.test.ts`, replace the `toEqual` block in the first `blocksToLines` test (`render.test.ts:54-61`) with the accent-bearing expectation:

```ts
    expect(lines).toEqual([
      { text: "You", color: "green", bold: true, blockIndex: 0, accent: "green" },
      { text: "  hi", blockIndex: 0, accent: "green" },
      { text: "", blockIndex: 0, accent: "green" },
      { text: "Claude", color: "blue", bold: true, blockIndex: 1, accent: "blue" },
      { text: "  yo", blockIndex: 1, accent: "blue" },
      { text: "", blockIndex: 1, accent: "blue" },
    ]);
```

Then add a new test at the end of the `blocksToLines` describe block (before its closing `});`):

```ts
  it("tags every line of a block with a kind-based accent color", () => {
    const { lines } = blocksToLines(
      [
        { kind: "thinking", text: "t" },
        { kind: "tool", name: "Bash", input: { command: "x" }, result: { text: "o", isError: false } },
        { kind: "tool", name: "Task", input: { subagent_type: "Explore", description: "d" } },
      ],
      40,
      new Set()
    );
    const accentOf = (i: number) => lines.find((l) => l.blockIndex === i)!.accent;
    expect(accentOf(0)).toBe("gray");    // thinking
    expect(accentOf(1)).toBe("cyan");    // tool
    expect(accentOf(2)).toBe("magenta"); // Task
    // applies to non-header lines too
    expect(lines.filter((l) => l.blockIndex === 1).every((l) => l.accent === "cyan")).toBe(true);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/__tests__/render.test.ts`
Expected: FAIL — accent is `undefined` (field missing).

- [ ] **Step 3: Add accent in the builder**

In `src/render.ts`, add the field to the `Line` interface (after `hint?`):

```ts
  // Left-gutter accent color for the line, keyed to the owning block's kind.
  accent?: string;
```

Then in `blocksToLines`, inside the `blocks.forEach((block, i) => {` body, compute the accent and thread it through `push` by replacing the existing `start`/`push` lines (`render.ts:116-118`) with:

```ts
    const start = lines.length;
    const accent =
      block.kind === "user"
        ? "green"
        : block.kind === "assistant"
          ? "blue"
          : block.kind === "thinking"
            ? "gray"
            : block.name === "Task"
              ? "magenta"
              : "cyan";
    const push = (text: string, opts: Partial<Line> = {}) =>
      lines.push({ text, blockIndex: i, accent, ...opts });
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test src/__tests__/render.test.ts`
Expected: PASS.

- [ ] **Step 5: Render the accent gutter**

In `src/components/SessionDetail.tsx`, replace the gutter `Text` (`SessionDetail.tsx:52`) with one that falls back to the accent bar when the line isn't the focus cursor:

```tsx
              <Text color={isLineFocused ? "cyan" : ln.accent} dimColor={!isLineFocused}>
                {isLineFocused ? "▌" : ln.accent ? "│" : " "}
              </Text>
```

- [ ] **Step 6: Full suite + build**

Run: `bun test` → PASS. Run: `bun run build` → clean.

- [ ] **Step 7: Visual check**

Run: `bun run dev`, open a session. Each block shows a thin colored left bar (green = you, blue = Claude, cyan = tool, magenta = Task, gray = thinking); the focused block still shows the bright `▌` cursor.

- [ ] **Step 8: Commit**

```bash
git add src/render.ts src/__tests__/render.test.ts src/components/SessionDetail.tsx
git commit -m "feat: add per-block accent gutter to the detail pane"
```

---

### Task 6: Detail scrollbar gutter

Replace the bare `%` indicator's role with a real scrollbar column on the right edge of the detail pane (the `%` text stays in the metadata line as a number; the bar gives proportion + position at a glance).

**Files:**
- Create: `src/scrollbar.ts`
- Create: `src/__tests__/scrollbar.test.ts`
- Modify: `src/components/SessionDetail.tsx`

**Interfaces:**
- Produces: `scrollbar(offset: number, total: number, visible: number): string[]` — returns exactly `visible` glyphs: `"█"` (thumb) over `"░"` (track), or all `" "` when everything fits.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/scrollbar.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { scrollbar } from "../scrollbar";

describe("scrollbar", () => {
  it("returns blanks when all content fits", () => {
    expect(scrollbar(0, 5, 10)).toEqual([" ", " ", " ", " ", " ", " ", " ", " ", " ", " "]);
  });

  it("has the right number of cells", () => {
    expect(scrollbar(0, 100, 10).length).toBe(10);
  });

  it("puts the thumb at the top when offset is 0", () => {
    const bar = scrollbar(0, 100, 10);
    expect(bar[0]).toBe("█");
    expect(bar[bar.length - 1]).toBe("░");
  });

  it("puts the thumb at the bottom at max offset", () => {
    const bar = scrollbar(90, 100, 10); // maxOffset = 90
    expect(bar[bar.length - 1]).toBe("█");
    expect(bar[0]).toBe("░");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/__tests__/scrollbar.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/scrollbar.ts`:

```ts
// src/scrollbar.ts
// Pure scrollbar: one glyph per visible row — a thumb over a track, sized and
// positioned by the scroll offset. Blank when nothing scrolls.
export function scrollbar(offset: number, total: number, visible: number): string[] {
  if (total <= visible) return Array.from({ length: visible }, () => " ");
  const thumbSize = Math.max(1, Math.round((visible / total) * visible));
  const maxOffset = total - visible;
  const maxThumbStart = visible - thumbSize;
  const thumbStart = maxOffset === 0 ? 0 : Math.round((offset / maxOffset) * maxThumbStart);
  return Array.from({ length: visible }, (_, i) =>
    i >= thumbStart && i < thumbStart + thumbSize ? "█" : "░"
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test src/__tests__/scrollbar.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Render the scrollbar column**

In `src/components/SessionDetail.tsx`:

(a) Add the import at the top:

```tsx
import { scrollbar } from "../scrollbar";
```

(b) Compute the bar after `const visible = ...` (near `SessionDetail.tsx:28`):

```tsx
  const bar = scrollbar(scrollOffset, lines.length, visibleRows);
```

(c) Wrap the lines column and a 1-wide scrollbar column in a row. Replace the content `<Box flexDirection="column">...</Box>` (`SessionDetail.tsx:47-60`) with:

```tsx
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" flexGrow={1}>
          {visible.map((ln, i) => {
            const isLineFocused = ln.blockIndex === cursor;
            return (
              <Box key={scrollOffset + i}>
                <Text color={isLineFocused ? "cyan" : ln.accent} dimColor={!isLineFocused}>
                  {isLineFocused ? "▌" : ln.accent ? "│" : " "}
                </Text>
                <Text color={ln.color} bold={ln.bold} dimColor={ln.dim} wrap="truncate">
                  {ln.text === "" ? " " : ln.text}
                </Text>
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
```

- [ ] **Step 6: Full suite + build**

Run: `bun test` → PASS. Run: `bun run build` → clean.

- [ ] **Step 7: Visual check**

Run: `bun run dev`, open a long session, scroll with `j`/`Ctrl-d`. A thumb track appears on the right edge; the thumb size reflects how much of the transcript is visible and slides from top to bottom as you scroll. Short sessions show no bar.

- [ ] **Step 8: Commit**

```bash
git add src/scrollbar.ts src/__tests__/scrollbar.test.ts src/components/SessionDetail.tsx
git commit -m "feat: add a scrollbar gutter to the detail pane"
```

---

### Task 7: Detail metadata cleanup, focus border, status-bar hints

Final polish: trim the detail metadata line (drop the noisy filename, fix `1 turns`), move the transient key hints to the status bar, and color the pane divider by focus so "where am I" is consistent.

**Files:**
- Modify: `src/components/SessionDetail.tsx`
- Modify: `src/components/StatusBar.tsx`
- Modify: `src/components/App.tsx`

**Interfaces:** none new.

- [ ] **Step 1: Clean up the detail metadata line**

In `src/components/SessionDetail.tsx`:

(a) Remove the now-unused path import (`SessionDetail.tsx:4`): delete `import path from "path";`.

(b) Replace the metadata `Box` (`SessionDetail.tsx:40-46`) with:

```tsx
      <Box marginBottom={1}>
        <Text dimColor>
          {relativeTime(session.updatedAt)} · {turnCount} {turnCount === 1 ? "turn" : "turns"}
          {scrollable ? ` · ${pct}%` : ""}
        </Text>
      </Box>
```

(The `· scrolling · Ctrl+O expand · Esc to list` suffix is removed here; those hints move to the status bar in Step 2. The literal `·` is the middle-dot character U+00B7; type it directly rather than the escape if your editor allows.)

- [ ] **Step 2: Add the detail key hints to the status bar**

In `src/components/StatusBar.tsx`, update the `detail` hint string to include `Ctrl+O expand`:

```tsx
  const hint =
    focus === "detail"
      ? "j/k scroll · Ctrl-d/u page · g/G top/bottom · Ctrl+O expand · r resume · Esc back · q quit"
      : hasDetail
        ? "j/k navigate · / search · enter view · r resume · q quit"
        : "j/k navigate · / search · enter view · q quit";
```

- [ ] **Step 3: Color the pane divider by focus**

In `src/components/App.tsx`, replace the divider `Box` (`App.tsx:190`) with a focus-colored border:

```tsx
            <Box
              borderStyle="single"
              borderColor={detailFocused ? "cyan" : "gray"}
              borderLeft
              borderRight={false}
              borderTop={false}
              borderBottom={false}
            />
```

- [ ] **Step 4: Build + full suite**

Run: `bun run build` → clean (confirm no leftover `path` reference in SessionDetail). Run: `bun test` → PASS.

- [ ] **Step 5: Visual check**

Run: `bun run dev`. The detail header line is now just `<time> · N turns · NN%`; a session with one turn reads `1 turn`; the scroll/expand/resume hints all live in the bottom status bar; the divider between panes is cyan when the detail pane is focused and gray when the list is focused.

- [ ] **Step 6: Commit**

```bash
git add src/components/SessionDetail.tsx src/components/StatusBar.tsx src/components/App.tsx
git commit -m "feat: tidy detail metadata, move key hints to status bar, focus-color the divider"
```

---

## Self-Review

**Spec coverage (against the conversation's suggestions):**
- Search bar indistinguishable → Task 1 (border, focus color, placeholder, count chip). ✓
- List 3-row waste + long-name wrap breaking scroll math → Task 2/3 (2-row compact, truncation, row model). ✓
- Selection highlight via background → Task 3. ✓
- Date grouping → Task 2/3 (`dateBucket`, headers in `sessionsToRows`). ✓
- Scrollbar gutter → Task 6. ✓
- Turn accent / per-block color + contrast → Task 5. ✓
- Header count + active filter → Task 4. ✓
- Focused-pane border consistency → Task 1 (search), Task 7 (divider). ✓
- Metadata cleanup (drop `.jsonl`, singular `turn`), hints to status bar → Task 7. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full code; every test step shows assertions and the exact run command + expected result.

**Type consistency:** `searchBarView`, `dateBucket`, `sessionsToRows`/`ListRow`, `truncateEnd`, `headerSummary`, `scrollbar`, and the `Line.accent` field are each defined in the task that introduces them and consumed with matching signatures downstream. `SessionList`'s new prop shape (Task 3) matches what `App` passes. `useBlockNav`'s signature matches its existing definition in `nav.ts`.

**Known deferrals / notes:**
- `useVimNav`/`computeNav` in `nav.ts` become unused by the app after Task 3 but remain exported and covered by `nav.test.ts`; left in place intentionally to avoid churn. A follow-up could delete them.
- The `·` (U+00B7), box-drawing, and emoji characters are written as `\u…` escapes in this plan for unambiguous copying; they may be typed as literals in the source if preferred.

---

## Execution Handoff

Test-count expectations as tasks land: baseline 46 → +5 (Task 1) → +14 (Task 2) → (Task 3 no new) → (Task 4 none) → +1 (Task 5) → +4 (Task 6) → (Task 7 none) = **70 tests**.
