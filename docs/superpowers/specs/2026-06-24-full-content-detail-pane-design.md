# Full-content detail pane

## Goal

The detail pane currently shows only human-typed user messages and assistant
`text` blocks; everything else in the transcript is dropped. Enhance it to show
the full conversation: tool calls and their results, agent (`Task`) spawning,
and assistant thinking — rendered as compact summaries by default with a
keybinding to expand the focused block to full content.

## Decisions (from brainstorming)

- **Rendering:** compact summaries by default; `Ctrl+O` expands/collapses the
  focused block to full content.
- **Block types shown:** tool calls + results, agent spawning (`Task`),
  thinking blocks. System/meta entries (`system`, `mode`, `permission-mode`,
  `attachment`, `file-history-snapshot`, `ai-title`, `last-prompt`) are dropped.
- **Targeting:** a block cursor. `j`/`k` move a highlighted cursor between
  blocks; the viewport follows the cursor; `Ctrl+O` toggles the focused block.
- **Sub-agents are not inlined:** these transcripts contain no
  `isSidechain:true` entries, so "agent spawning" means rendering the `Task`
  tool call itself (description, subagent_type, prompt) — not a nested
  transcript.

## 1. Data model (`src/types.ts`)

Replace the flat `Turn` with a `Block` discriminated union preserving every
meaningful entry in transcript order:

- `{ kind: "user"; text: string }` — human-typed message
- `{ kind: "assistant"; text: string }` — assistant `text` block
- `{ kind: "thinking"; text: string }` — assistant extended-reasoning block
- `{ kind: "tool"; name: string; input: Record<string, unknown>; result?: { text: string; isError: boolean } }`
  — a `tool_use` paired with its matching `tool_result`, or no result if the
  call was never answered (e.g. an interrupted final turn)

`Task` is **not** a separate kind — it is a `tool` with `name === "Task"`,
special-cased only at render time. The `Turn` type is removed.

## 2. Parsing (`src/sessions.ts`)

`loadTurns` becomes `loadBlocks(session): { blocks: Block[]; turnCount: number }`:

- Walk entries in transcript order.
- For each `assistant` entry, iterate `message.content` in order, emitting
  `assistant`, `thinking`, and `tool` blocks. A `tool_use` block emits a `tool`
  block with `name`, `input`, and no result yet.
- Maintain a `Map<tool_use_id, Block>`. When a later `user` entry carries a
  `tool_result`, look up its `tool_use_id` and attach `{ text, isError }` to the
  matching tool block. `is_error` may be `true`/`false`/`null`; treat anything
  non-`true` as not an error.
- `tool_result.content` may be a string **or** an array of `{type:"text"}`
  (and other) blocks — flatten to a string (join the `text` of text blocks;
  ignore non-text blocks).
- `turnCount` stays = count of human-typed messages, for the header.
- `isHumanTypedMessage`, `parseLines`, `parseSessionMetadata`, and
  `loadSessions` (the lightweight list-loading path) are **unchanged**.

The pure core (entry array → `Block[]`) must stay testable without touching
disk, mirroring how `parseLines` is kept pure today.

## 3. Render (`src/render.ts`)

`turnsToLines` becomes
`blocksToLines(blocks, width, expanded: Set<number>): { lines: Line[]; ranges: { start: number; len: number }[] }`:

- `Line` gains `blockIndex: number` and `dim?: boolean` (for thinking).
- `ranges[i]` is the `[start, len)` line span of block `i`, used by the nav and
  viewport math.

Per-kind rendering:

- **`user`** — header `You` (green, bold) + wrapped text. Always full.
- **`assistant`** — header `Claude` (blue, bold) + wrapped text. Always full.
- **Collapsible** (`thinking`, `tool`, `Task`) — render compact unless
  `expanded.has(i)`:
  - **`tool`** header: `▸ <Name>  <arg-summary>`.
    - `summarizeTool(name, input)`: Bash → first line of `command`;
      Read/Edit/Write → `basename(file_path)`; Grep/Glob → `pattern`; else the
      first input value, stringified and truncated.
    - result line: `└ <ok|error> · <N> lines` plus the first ~3 lines of the
      result as preview; the error marker is colored red when `isError`.
    - expanded: full input (full command, full Edit `old_string`/`new_string`)
      and full result text.
  - **`Task`** header: `◆ Task(<subagent_type>)  <description>`. Compact shows
    the description; expanded adds the prompt (and result, if any).
  - **`thinking`**: dim header `✻ Thinking` + first ~2 lines (dimmed); expanded
    shows full text, dimmed.

`user`/`assistant` blocks render identically whether or not they are in
`expanded` (toggling them is a harmless no-op), keeping the toggle model
uniform across all blocks.

## 4. Navigation (`src/nav.ts`)

The detail pane moves from pure line-scroll to a **block cursor with intra-block
overflow scroll**. New pure function:

`computeBlockScroll({ cursor, offset, ranges, visibleRows, key }): { cursor: number; offset: number }`

- `j` / `↓`: if the focused block extends past the viewport bottom
  (`ranges[cursor].start + len > offset + visibleRows`), scroll down one line;
  otherwise advance `cursor` by one and bring the next block's top into view
  (a block taller than the viewport aligns its top to the viewport top).
- `k` / `↑`: symmetric — reveal the focused block's top if it's above the
  viewport, otherwise retreat `cursor`.
- `g g` → first block, `offset = 0`.
- `G` → last block, offset clamped so the last content is visible.
- `Ctrl-d` / `Ctrl-u` → half-page line scroll, then snap `cursor` to the
  topmost block intersecting the new `offset`.
- All movement clamps `cursor` to `[0, blocks.length-1]` and `offset` to
  `[0, maxOffset]`.

New `useBlockNav` hook wraps `computeBlockScroll` with `useInput` + an `enabled`
flag, mirroring the existing `useScroll`. The old `computeScroll` / `useScroll`
and their test are **removed** — the detail pane was their only consumer.

`Ctrl+O` (`key.ctrl && input === "o"`) toggles the current `cursor` index in the
`expanded` set. It lives in `App`'s action `useInput` handler, gated to detail
focus (not in `useBlockNav`, to keep the nav hook focused on movement).

## 5. App wiring (`src/components/App.tsx`)

- New state: `blocks: Block[]`, `expanded: Set<number>`. (`turns` is removed.)
- On opening a session (Enter in the list): call `loadBlocks`, reset
  `expanded` to empty and the cursor/offset to 0.
- `useMemo` recomputes `{ lines, ranges }` from `blocks`, `detailWidth`, and
  `expanded`; recompute whenever `expanded` changes so reflow is immediate.
- Drive the detail viewport from `useBlockNav(ranges, detailVisibleRows, enabled)`
  and pass the resulting `cursor` to `SessionDetail` for highlighting.
- The `< 80` columns hide-detail-pane rule is unchanged.
- Filter-change reset (`resetList`, clear selection) extends to clearing
  `blocks` and `expanded`.

## 6. Detail component (`src/components/SessionDetail.tsx`)

- Accept `cursor` (focused block index) in addition to the existing props.
- Highlight the focused block: a left `▌` gutter on every line whose
  `blockIndex === cursor`, and the block's header rendered `inverse` (or a
  background color). Non-focused lines render as today.
- Header line (path, mtime, turn count, scroll %) is unchanged except the
  scrolling hint may mention `Ctrl+O expand`.

## 7. Mutual exclusion & search

- `useBlockNav` is active only when the detail pane is focused and search is not
  focused — same gating discipline as the existing hooks, so `j`/`k` never
  double-handle between list and detail.
- Body search (ripgrep over the raw `.jsonl` files in `src/search.ts`) is
  untouched. Bonus: the pane now renders tool content, so what the user reads
  matches what `/` search finds in the file.

## 8. Testing

Pure-function tests under `src/__tests__/`, per repo convention (no React
component tests):

- **`sessions`**: `loadBlocks` core — tool_use/tool_result pairing by id,
  thinking blocks, `Task` blocks, string vs array `tool_result.content`,
  `is_error` null/false/true handling, and a tool call with no result.
- **`render`**: `blocksToLines` compact vs expanded output, `ranges`
  correctness (start/len match emitted lines), and `summarizeTool` per tool
  name.
- **`nav`**: `computeBlockScroll` — block jump (`j`/`k`), intra-block overflow
  scroll for tall blocks, `g g`, `G`, `Ctrl-d`/`Ctrl-u`, clamping, and that
  changing `expanded` reflows `ranges` so the cursor stays on the same block.

## Out of scope

- Inlining/rendering nested sub-agent transcripts (sidechains are not present
  in these files).
- Rendering images or non-text tool_result content blocks.
- System/meta entry display.
- Any change to the session list, fuzzy search, or resume handoff.
