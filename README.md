# claude-sessions

A terminal UI for browsing and resuming past Claude Code sessions.

Reads the `.jsonl` transcripts that Claude Code writes under `~/.claude/projects/`, lets you scroll through conversations, search across all sessions with regex, and resume any session by replacing the current process with `claude --resume <id>`.

macOS/arm64 only.

## Requirements

- [Bun](https://bun.sh) runtime
- [ripgrep](https://github.com/BurntSushi/ripgrep) (`rg`) for full-body search
- macOS on Apple Silicon

## Usage

```bash
# run from source
bun run dev

# or build a standalone binary and run it
bun run build
./dist/claude-sessions
```

## Key bindings

| Key | Action |
|-----|--------|
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `g g` | Jump to top |
| `G` | Jump to bottom |
| `Ctrl+d` / `Ctrl+u` | Page down / up |
| `Enter` | Open session detail |
| `r` | Resume session in Claude |
| `Esc` | Back to list |
| `q` | Quit |
| `?` | Toggle help |
| `/` | Open search |

### Search

Search is a regex applied across the raw transcript files (`rg -l -S`). Smart-case: a lowercase query is case-insensitive; any uppercase letter makes it case-sensitive. Press `Enter` to submit, `Esc` to close. An empty query clears the filter.

## Architecture

```
src/
  index.tsx        entry point — renders App, handles resume handoff
  sessions.ts      filesystem reader: loadSessions(), loadBlocks()
  search.ts        full-body search via rg
  nav.ts           vim navigation (pure functions + useBlockNav hook)
  render.ts        Block[] → Line[] (word-wrap, no React)
  listrender.ts    Session[] → ListRow[] for the list pane
  exec.ts          execvp via bun:ffi (true process replace for resume)
  insearch.ts      in-session search state
  searchbar.ts     search bar input state
  help.ts          key binding definitions
  types.ts         shared types
  components/
    App.tsx          single stateful component, owns all layout math
    SessionList.tsx  list pane (presentational)
    SessionDetail.tsx detail pane (presentational)
    SearchBar.tsx    session search input
    DetailSearchBar.tsx in-session search input
    StatusBar.tsx    bottom status line
    HelpScreen.tsx   help overlay
```

Data flows one direction: filesystem → pure parsers → React state → Ink render. Parsing, navigation, and render logic live in pure functions covered by `src/__tests__/`.

## Development

```bash
bun test                              # run all tests
bun test src/__tests__/nav.test.ts    # run a single test file
```
