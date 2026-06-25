# Help Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen help overlay triggered by `?` that displays all keybindings grouped into two balanced columns.

**Architecture:** Pure keybinding data lives in `src/help.ts`; a presentational `HelpScreen` component renders the overlay; `App.tsx` owns the `helpOpen` boolean and swaps the render tree when it is true — the same pattern used for search focus.

**Tech Stack:** Bun, React, Ink

## Global Constraints

- Bun runtime — use `bun:test` for tests, not Jest/Vitest
- No new dependencies
- Pure functions go in `src/` modules; React components go in `src/components/`
- All tests live in `src/__tests__/`

---

### Task 1: Keybinding data and column-split logic (`src/help.ts`)

**Files:**
- Create: `src/help.ts`
- Create: `src/__tests__/help.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Binding { key: string; description: string; }
  export interface Category { title: string; bindings: Binding[]; }
  export const CATEGORIES: Category[];
  export function splitColumns(categories: Category[], splitAt: number): [Category[], Category[]];
  ```

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/help.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { CATEGORIES, splitColumns } from "../help";

describe("CATEGORIES", () => {
  it("has at least 4 categories", () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(4);
  });

  it("every category has a non-empty title and at least one binding", () => {
    for (const cat of CATEGORIES) {
      expect(cat.title.length).toBeGreaterThan(0);
      expect(cat.bindings.length).toBeGreaterThan(0);
    }
  });

  it("every binding has a non-empty key and description", () => {
    for (const cat of CATEGORIES) {
      for (const b of cat.bindings) {
        expect(b.key.length).toBeGreaterThan(0);
        expect(b.description.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("splitColumns", () => {
  it("splits at the given index", () => {
    const [left, right] = splitColumns(CATEGORIES, 2);
    expect(left).toHaveLength(2);
    expect(right).toHaveLength(CATEGORIES.length - 2);
  });

  it("left + right contains all categories", () => {
    const [left, right] = splitColumns(CATEGORIES, 2);
    expect([...left, ...right]).toEqual(CATEGORIES);
  });

  it("splitAt 0 gives empty left column", () => {
    const [left, right] = splitColumns(CATEGORIES, 0);
    expect(left).toHaveLength(0);
    expect(right).toEqual(CATEGORIES);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/jchan/git/claude-sessions && bun test src/__tests__/help.test.ts
```

Expected: FAIL — `../help` not found.

- [ ] **Step 3: Implement `src/help.ts`**

```ts
// src/help.ts

export interface Binding {
  key: string;
  description: string;
}

export interface Category {
  title: string;
  bindings: Binding[];
}

export const CATEGORIES: Category[] = [
  {
    title: "NAVIGATION",
    bindings: [
      { key: "j / ↓",   description: "move down" },
      { key: "k / ↑",   description: "move up" },
      { key: "g g",      description: "top" },
      { key: "G",        description: "bottom" },
      { key: "Ctrl+d",   description: "page down" },
      { key: "Ctrl+u",   description: "page up" },
    ],
  },
  {
    title: "ACTIONS",
    bindings: [
      { key: "Enter",    description: "open session" },
      { key: "r",        description: "resume in Claude" },
      { key: "Esc",      description: "back to list" },
      { key: "q",        description: "quit" },
      { key: "?",        description: "toggle help" },
    ],
  },
  {
    title: "SEARCH",
    bindings: [
      { key: "/",           description: "open search" },
      { key: "Enter",       description: "submit" },
      { key: "Esc",         description: "close search" },
      { key: "← → Ctrl+f/b", description: "move cursor" },
      { key: "Ctrl+a",      description: "beginning of line" },
      { key: "Ctrl+e",      description: "end of line" },
      { key: "Ctrl+u",      description: "delete to beginning" },
      { key: "Ctrl+l",      description: "clear" },
    ],
  },
  {
    title: "DETAIL PANE",
    bindings: [
      { key: "Ctrl+o",   description: "expand / collapse block" },
    ],
  },
];

export function splitColumns(
  categories: Category[],
  splitAt: number
): [Category[], Category[]] {
  return [categories.slice(0, splitAt), categories.slice(splitAt)];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/jchan/git/claude-sessions && bun test src/__tests__/help.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/jchan/git/claude-sessions && git add src/help.ts src/__tests__/help.test.ts && git commit -m "feat: add help keybinding data and splitColumns utility"
```

---

### Task 2: `HelpScreen` overlay component

**Files:**
- Create: `src/components/HelpScreen.tsx`

**Interfaces:**
- Consumes:
  ```ts
  import { CATEGORIES, splitColumns, Category, Binding } from "../help";
  ```
- Produces:
  ```tsx
  // Props:
  interface Props { onClose: () => void; termCols: number; termRows: number; }
  export function HelpScreen(props: Props): JSX.Element
  ```

No test file — this is a pure presentational component with no logic to unit-test. Visual correctness is verified by running the app.

- [ ] **Step 1: Create `src/components/HelpScreen.tsx`**

```tsx
// src/components/HelpScreen.tsx
import React from "react";
import { Box, Text, useInput } from "ink";
import { CATEGORIES, splitColumns, type Category } from "../help";

interface Props {
  onClose: () => void;
}

function CategoryBlock({ category }: { category: Category }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="yellow">{category.title}</Text>
      {category.bindings.map((b) => (
        <Box key={b.key}>
          <Box width={20}><Text color="cyan">{b.key}</Text></Box>
          <Text dimColor>{b.description}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function HelpScreen({ onClose }: Props) {
  useInput((input, key) => {
    if (input === "?" || key.escape) onClose();
  });

  const [left, right] = splitColumns(CATEGORIES, 2);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">Claude Sessions — Help</Text>
      </Box>

      <Box flexDirection="row" gap={4} flexGrow={1}>
        <Box flexDirection="column" flexGrow={1}>
          {left.map((cat) => <CategoryBlock key={cat.title} category={cat} />)}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {right.map((cat) => <CategoryBlock key={cat.title} category={cat} />)}
        </Box>
      </Box>

      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>? or Esc to close</Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/jchan/git/claude-sessions && git add src/components/HelpScreen.tsx && git commit -m "feat: add HelpScreen overlay component"
```

---

### Task 3: Wire `HelpScreen` into `App.tsx`

**Files:**
- Modify: `src/components/App.tsx`
- Modify: `src/components/StatusBar.tsx`

**Interfaces:**
- Consumes: `HelpScreen` from `./HelpScreen`

- [ ] **Step 1: Add `helpOpen` state and `?` key handler to `App.tsx`**

In `src/components/App.tsx`:

1. Add import at top:
```tsx
import { HelpScreen } from "./HelpScreen";
```

2. Add state after the existing state declarations (around line 43):
```tsx
const [helpOpen, setHelpOpen] = useState(false);
```

3. In the global `useInput` that handles `q` (around line 117), add `?` toggle:
```tsx
useInput((input) => {
  if (input === "q") exit();
  if (input === "?" && !searchFocused) setHelpOpen((v) => !v);
});
```

4. In the action-keys `useInput` block, add an early-return guard so all action keys are inactive while help is open. Change the `isActive` option:
```tsx
{ isActive: !searchFocused && !helpOpen }
```

5. Wrap the return JSX: when `helpOpen` is true, render only `HelpScreen`:
```tsx
if (helpOpen) {
  return <HelpScreen onClose={() => setHelpOpen(false)} />;
}
```
Place this immediately before the existing `return (` at the bottom of the component.

- [ ] **Step 2: Update `StatusBar` hint to include `?`**

In `src/components/StatusBar.tsx`, add `· ? help` to the list hint:

```tsx
const hint =
  focus === "detail"
    ? "j/k scroll · Ctrl-d/u page · g/G top/bottom · Ctrl+O expand · r resume · Esc back · q quit"
    : hasDetail
      ? "j/k navigate · / search · enter view · r resume · ? help · q quit"
      : "j/k navigate · / search · enter view · ? help · q quit";
```

- [ ] **Step 3: Run the app and verify**

```bash
cd /Users/jchan/git/claude-sessions && bun run dev
```

Check:
- Press `?` → help screen replaces main view
- Both columns render with correct categories and bindings
- Press `?` again → returns to main view
- Press `Esc` → returns to main view
- `q` still quits from within help screen
- Status bar shows `? help` hint

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/jchan/git/claude-sessions && bun test
```

Expected: all tests PASS (no regressions).

- [ ] **Step 5: Commit**

```bash
cd /Users/jchan/git/claude-sessions && git add src/components/App.tsx src/components/StatusBar.tsx && git commit -m "feat: wire HelpScreen into App, add ? keybinding and status bar hint"
```
