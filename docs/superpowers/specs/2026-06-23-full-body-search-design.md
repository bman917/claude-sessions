# Full-body session search via ripgrep

**Date:** 2026-06-23
**Status:** Approved (pending spec review)

## Problem

The current `/` search uses Fuse.js to fuzzy-match only over each session's
`projectName` and `summary` (the first human message, truncated to 80 chars).
It never searches the conversation body, so you can't find the session where a
topic was actually discussed — which is the main thing you want when browsing
past sessions. This makes search effectively useless for its primary purpose.

## Solution

Replace the Fuse.js title/summary search with a full-body search backed by
ripgrep (`rg`) over the raw `.jsonl` transcripts under `~/.claude/projects`.
Search is **filter-only**: a query narrows the left session list to sessions
whose transcript contains the term. Opening and reading a session is unchanged.

## Behavior

- `/` opens the search box (unchanged).
- The user types a query and presses **Enter** to run it. Search runs **on
  Enter only** — not live/debounced.
- `Esc` exits the search box without running a search; the currently applied
  filter (if any) is left untouched.
- An empty query submitted with Enter clears the filter (all sessions shown).
- A successful search filters the list to matching sessions and shows a match
  count in the search bar (e.g. `3 matches`).
- If `rg` is not found on `PATH`, the UI shows `ripgrep not found` and the list
  stays unfiltered. There is **no fallback** search path.

## ripgrep invocation

```
rg -l -F -S -- <query> ~/.claude/projects
```

- `-l` — print only the paths of files that contain a match. Filter-only needs
  nothing more; we never display the matched text.
- `-F` — **fixed-string** search. Queries are always literal; there is no regex
  mode. A query like `claude --resume` or `a.b()` is searched verbatim.
- `-S` — smart-case: an all-lowercase query matches case-insensitively; any
  uppercase character makes the search case-sensitive.
- `--` — terminates flag parsing so a query beginning with `-` is not treated
  as an option.

### Exit codes

- `0` — matches found.
- `1` — no matches. This is **not** an error; it yields an empty result set.
- `2` — real error (treated as `rg-error`).
- Spawn failure with `ENOENT` — rg is not installed (`rg-missing`).

### Raw-JSONL caveat (accepted)

rg searches the raw JSONL bytes, which are escaped JSON, not the rendered text:

- A multi-word phrase that crosses a rendered newline will not match (the file
  contains a literal `\n`).
- Matches can originate from tool-result or system content, not just
  human/assistant prose.

This is acceptable because the result is used only as a yes/no list filter; raw
matched text is never displayed.

## Code changes

### Removed

- `src/fuzzy.ts` and `src/__tests__/fuzzy.test.ts`.
- The `fuse.js` dependency in `package.json`.

### New: `src/search.ts`

Two units:

- `parseRgOutput(stdout: string): Set<string>` — **pure**. Maps newline-separated
  file paths to session IDs (file basename minus `.jsonl`), ignoring blank
  lines and deduping. Unit-tested.
- `searchBodies(query: string, dir?: string)` — thin wrapper that runs rg via
  `Bun.spawnSync` and returns a discriminated result:
  - `{ ok: true; ids: Set<string> }`
  - `{ ok: false; error: "rg-missing" | "rg-error" }`

  `dir` defaults to the sessions directory (`~/.claude/projects`); the parameter
  exists for testability. Exit code `1` (no matches) returns
  `{ ok: true, ids: <empty set> }`.

### `src/components/App.tsx`

- Remove the `fuse` memo and the `filteredSessions` memo that called
  `searchSessions`.
- Add state:
  - `matchedIds: Set<string> | null` — `null` means no active filter.
  - `searchError: string | null`.
- Derive `filteredSessions`:
  - `matchedIds ? sessions.filter((s) => matchedIds.has(s.id)) : sessions`.
- The effect that resets list selection / focus / selected session on a search
  change now keys on `matchedIds` (the applied filter) instead of `query`
  (which changes per keystroke without filtering).
- Add the submit handler passed to `SearchBar` (see below): on submit, if the
  query is empty, clear `matchedIds` and `searchError`; otherwise call
  `searchBodies` and set `matchedIds` / `searchError` from the result. Exit
  search focus afterward.

### `src/components/SearchBar.tsx`

- Add an `onSubmit(query: string)` prop, invoked on Enter (Enter currently only
  calls `onExit`).
- Render the match count when a filter is active, and the `ripgrep not found`
  error when `searchError` is set.

## Testing

- `src/__tests__/search.test.ts` covering `parseRgOutput`:
  - paths → session IDs (basename minus `.jsonl`)
  - blank-line handling
  - dedupe of repeated paths
- `searchBodies` is a thin `Bun.spawnSync` wrapper and is not unit-tested; it is
  covered by the pure parser plus manual verification.
- Existing `nav`, `sessions`, `render`, `scroll` tests are unaffected.

## Out of scope (YAGNI)

- Regex search mode.
- Live/debounced search as you type.
- In-process scan fallback when rg is absent.
- Displaying matched snippets or jumping to the matching turn in the detail
  pane.
