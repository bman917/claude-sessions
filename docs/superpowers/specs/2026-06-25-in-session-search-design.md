# In-session search (within the loaded detail pane)

**Date:** 2026-06-25
**Status:** Approved

## Goal

When a session is open in the detail pane, let the user search *within that one
loaded conversation*, vim-style. This is distinct from the existing top
search bar, which runs ripgrep across all transcript files to filter the
session **list**. In-session search never touches the filesystem — it operates
on the already-loaded `blocks`/`lines` of the focused session.

## Behavior (vim-style)

- Detail focused, `/` opens a **bottom prompt** (a dedicated line above the
  status bar, separate from the top list-search bar).
- Type a pattern (regex, smart-case — same convention as list search:
  lowercase → case-insensitive, any uppercase → case-sensitive).
- `Enter`:
  - Runs the search over the full session content.
  - Auto-expands any collapsed blocks (thinking / tool / Task) that contain a
    match, so the match becomes visible.
  - Jumps to the **first** match and closes the prompt.
  - The matched substring is highlighted — **only the current match**, not all.
- `n` / `N` cycle to the next / previous match (wrapping around), scrolling to
  keep the current match visible.
- `Esc` in detail (prompt closed): if a search is active, **clears** it
  (removes highlight, drops match state) and stays in the detail pane; if no
  search is active, returns focus to the list (current behavior).
- `Esc` while the prompt is open: cancels the prompt, keeps the previously
  active search (if any).
- Empty query + `Enter`: clears the active search.
- Match position (`3/12`), `no matches`, and `invalid regex` are surfaced in
  the detail header line.

## Architecture

Data flow stays one-directional: `blocks` → pure matchers → React state →
render. No new filesystem access.

### New pure module: `src/insearch.ts`

- `compileQuery(pattern: string): RegExp | null`
  - Smart-case: case-insensitive unless the pattern contains an uppercase
    letter. Global flag for multi-match scanning.
  - Returns `null` on an invalid regex (caller surfaces "invalid regex").
- `findBlocksMatching(blocks, width, regex): Set<number>`
  - Computes which block indices contain a match. Implemented by flattening the
    conversation with **all blocks expanded** (`blocksToLines(blocks, width,
    allExpandedSet)`) and collecting the `blockIndex` of every line that
    matches. Reusing `blocksToLines` keeps wrapping/rendering identical to the
    display path, so expansion decisions are consistent.
  - Drives auto-expand.
- `findMatches(lines, regex): Match[]`
  - `Match = { lineIndex: number; blockIndex: number; col: number; length: number }`.
  - Scans each rendered line's `text` for all (global) matches, in document
    order (by `lineIndex`, then `col`). `col`/`length` index into `ln.text`
    (which includes the leading indent), so the renderer can split the line
    directly.

### `src/nav.ts` — `useBlockNav` extension

- Add a pure helper `computeScrollTo(lineIndex, visibleRows, totalLines):
  number` that returns an `offset` centering `lineIndex` in the viewport,
  clamped to `[0, max(0, totalLines - visibleRows)]`.
- Expose an imperative `jumpTo(lineIndex, blockIndex)` from the hook that sets
  `{ cursor: blockIndex, offset: computeScrollTo(...) }`.
- `n` / `N` only move the match index in `App`; the jump effect calls `jumpTo`.

### `src/components/App.tsx` — state and wiring

New state:

- `dQuery: string` — text currently typed in the bottom prompt.
- `dPattern: string | null` — the committed/active pattern (`null` = no active
  search). Drives matching and highlight.
- `dFocused: boolean` — bottom prompt open/focused.
- `dMatchIdx: number` — index of the current match.
- `dError: string | null` — invalid-regex message.

Derived:

- `matches = useMemo(() => dPattern ? findMatches(lines, compileQuery(dPattern)!)
  : [], [lines, dPattern])`. Recomputes after auto-expand reflows `lines`.
- Effect: when `matches` or `dMatchIdx` changes and `matches.length > 0`, call
  `jumpTo(matches[dMatchIdx])`.
- Effect/guard: clamp `dMatchIdx` to `0` when `matches` shrinks (reflow,
  expand/collapse, width change).

Submit handler (`Enter` in prompt):

1. If query is empty → clear (`dPattern = null`, `dError = null`).
2. `compileQuery`; if `null` → set `dError = "invalid regex"`, leave prompt
   open, don't change `dPattern`.
3. Else: `setExpanded(prev => union(prev, findBlocksMatching(...)))`,
   `setDPattern(query)`, `setDFocused(false)`, `setDMatchIdx(0)`,
   `setDError(null)`.

Reset detail-search state (`dPattern`, `dQuery`, `dFocused`, `dMatchIdx`,
`dError`) when a different session is opened.

Key gating:

- Detail `useBlockNav` `enabled` = `!searchFocused && !dFocused && detailFocused`.
- Action `useInput` `isActive` adds `&& !dFocused`.
- `/`: `focus === "list"` → `setSearchFocused(true)`; `focus === "detail"` →
  `setDFocused(true)`.
- `n` / `N` (in the action handler, detail focused, `dPattern` active) move
  `dMatchIdx` with wraparound.
- `Esc` (action handler, detail focused): if `dPattern` → clear search; else
  `setFocus("list")`.

### `src/components/DetailSearchBar.tsx` (new)

Bottom prompt modeled on `SearchBar`'s line-editing (cursor, `Ctrl-a/e/u/l`,
backspace, left/right). Rendered above `StatusBar` only when `dFocused`.
Handles `Enter` (submit), `Esc` (cancel prompt without clearing the active
search). Its `useInput` is the only active handler while `dFocused`.

### `src/components/SessionDetail.tsx`

- New props: `currentMatch: { lineIndex, col, length } | null` and
  `matchInfo: { index, total } | null` (plus an error flag/string).
- For the line where `scrollOffset + i === currentMatch.lineIndex`, split
  `ln.text` into pre / match / post and render the match segment with a
  highlight (e.g. `backgroundColor="yellow" color="black"`). Other lines render
  unchanged.
- Header line shows `matchInfo` as `index/total`, or `no matches` /
  `invalid regex` when applicable.

### `src/components/StatusBar.tsx`

Detail hint gains `/ search · n/N next/prev`.

## Testing (pure)

- `src/__tests__/insearch.test.ts`:
  - `compileQuery`: smart-case lower vs upper; invalid regex → `null`.
  - `findMatches`: positions/order across multiple lines; multiple matches per
    line; no matches → empty.
  - `findBlocksMatching`: match inside a collapsed block's hidden content is
    found (verifies the all-expanded flattening).
- `src/__tests__/nav.test.ts`:
  - `computeScrollTo`: centers a line; clamps at top and bottom; line already
    visible.

Per repo convention, all logic stays in pure functions; no React-component
tests.

## Known limitation

A regex that spans a word-wrap boundary won't match — search is per-rendered
line. Acceptable for v1; documented so it isn't mistaken for a bug.
