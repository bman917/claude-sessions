# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A terminal UI (Ink + React) for browsing past Claude Code sessions and resuming
one. It reads the `.jsonl` transcripts that Claude Code writes under
`~/.claude/projects/`, lists them, lets you fuzzy-search and scroll through a
conversation, and on `r` replaces its own process with `claude --resume <id>`.

## Commands

```bash
bun run dev      # run the TUI from source (src/index.tsx)
bun test         # run all tests
bun test src/__tests__/nav.test.ts   # run a single test file
bun run build    # compile a standalone binary -> dist/claude-sessions
```

Runtime is **Bun**, not Node. The build target is hardcoded to
`bun-darwin-arm64` and `src/exec.ts` calls macOS libc directly — this is a
macOS/arm64-only tool.

## Architecture

Data flows in one direction: filesystem → pure parsers → React state → Ink render.

- **`src/sessions.ts`** — the only filesystem reader. `loadSessions()` scans every
  project dir under `~/.claude/projects/` and parses lightweight metadata from
  the first 50 lines of each `.jsonl` (so the list loads fast); `loadTurns()`
  reads a full transcript on demand when a session is opened. A session is only
  recognized via `isHumanTypedMessage` — an entry that is `type: "user"` with
  `origin.kind === "human"` and `promptSource === "typed"`. This filters out
  tool results, system messages, and synthetic user turns. Keep `parseLines`
  pure (it takes lines + mtime) so it stays testable without touching disk.

- **`src/components/App.tsx`** — the single stateful component. Owns sessions,
  query, focus (`"list"` | `"detail"`), the selected session, and its loaded
  turns. Wires the leaf components together and holds all the layout math
  (visible-row counts, pane widths). The right detail pane is hidden when the
  terminal is narrower than 80 columns. Everything else under `components/` is a
  presentational leaf.

- **`src/nav.ts`** — vim navigation, split into pure functions and hooks.
  `computeNav` moves a *cursor* (scrolls only when the cursor leaves the
  window — for the session list); `computeScroll` moves a *viewport* over fixed
  lines (for the detail pane). The `useVimNav`/`useScroll` hooks wrap them with
  `useInput` and an `enabled` flag. Both support `j/k`, arrows, `g g`, `G`,
  `Ctrl-d`, `Ctrl-u`. Only one input handler is active at a time, gated by the
  `enabled`/`isActive` flags driven by focus and search state.

- **`src/render.ts`** — pure transform from `Turn[]` to scrollable `Line[]`,
  with word-wrapping (`wrapText`) to a given column width. No React.

- **`src/fuzzy.ts`** — Fuse.js search over `projectName` (weight 0.6) and
  `summary` (0.4).

- **`src/exec.ts`** — `execReplace` does a true `execvp` via `bun:ffi` against
  `libSystem.B.dylib`. Bun has no built-in exec; this replaces the process image
  entirely so no parent lingers behind the resumed `claude`.

- **`src/index.tsx`** — entry point. Renders `<App>`, and on resume waits for
  Ink to fully unmount (`waitUntilExit`) so terminal modes/cursor are restored,
  then `chdir`s into the session's project dir and `execReplace`s into
  `claude --resume`. The resume handoff is deliberately split this way; don't
  call exec while Ink still holds the terminal.

## Conventions

- Keep parsing/navigation/render logic in pure functions; the `__tests__` cover
  those (`nav`, `fuzzy`, `sessions`, `render`, `scroll`). Add tests there rather
  than testing React components.
- `useInput` handlers must stay mutually exclusive via their `isActive` flag —
  overlapping active handlers cause double-handled keys (e.g. `j` moving both
  the list and the detail).
