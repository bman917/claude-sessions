// src/nav.ts
import { useState, useRef, useEffect } from "react";
import { useInput } from "ink";

export type NavAction = "up" | "down" | "top" | "bottom" | "halfDown" | "halfUp";

export function computeNav(
  current: { index: number; offset: number },
  action: NavAction,
  listLength: number,
  visibleRows: number
): { index: number; offset: number } {
  if (listLength === 0) return { index: 0, offset: 0 };

  const clamp = (n: number) => Math.max(0, Math.min(n, listLength - 1));
  const half = Math.max(1, Math.floor(visibleRows / 2));

  let newIndex: number;
  switch (action) {
    case "up":       newIndex = clamp(current.index - 1); break;
    case "down":     newIndex = clamp(current.index + 1); break;
    case "top":      return { index: 0, offset: 0 };
    case "bottom":   newIndex = clamp(listLength - 1); break;
    case "halfDown": newIndex = clamp(current.index + half); break;
    case "halfUp":   newIndex = clamp(current.index - half); break;
  }

  let offset = current.offset;
  if (newIndex < offset) offset = newIndex;
  if (newIndex >= offset + visibleRows) offset = newIndex - visibleRows + 1;
  offset = Math.max(0, offset);

  return { index: newIndex, offset };
}

export function useVimNav(
  listLength: number,
  visibleRows: number,
  enabled: boolean
): { index: number; offset: number; reset: () => void } {
  const [nav, setNav] = useState({ index: 0, offset: 0 });
  const lastGTime = useRef(0);

  // Clamp index when list shrinks (e.g. after search filters)
  useEffect(() => {
    setNav((prev) => {
      if (prev.index < listLength) return prev;
      return computeNav(prev, "bottom", listLength, visibleRows);
    });
  }, [listLength, visibleRows]);

  useInput(
    (input, key) => {
      if (input === "j" || key.downArrow) {
        setNav((prev) => computeNav(prev, "down", listLength, visibleRows));
      } else if (input === "k" || key.upArrow) {
        setNav((prev) => computeNav(prev, "up", listLength, visibleRows));
      } else if (input === "G") {
        setNav((prev) => computeNav(prev, "bottom", listLength, visibleRows));
      } else if (input === "g") {
        const now = Date.now();
        if (now - lastGTime.current < 500) {
          setNav({ index: 0, offset: 0 });
          lastGTime.current = 0;
        } else {
          lastGTime.current = now;
        }
      } else if (key.ctrl && input === "d") {
        setNav((prev) => computeNav(prev, "halfDown", listLength, visibleRows));
      } else if (key.ctrl && input === "u") {
        setNav((prev) => computeNav(prev, "halfUp", listLength, visibleRows));
      }
    },
    { isActive: enabled }
  );

  const reset = () => setNav({ index: 0, offset: 0 });
  return { index: nav.index, offset: nav.offset, reset };
}

// --- Block-cursor scrolling (e.g. the detail pane) -------------------------
// Moves a cursor (block) within a list of ranges, scrolling the viewport to
// keep the cursor visible. Unlike computeNav (which moves items in a list),
// this tracks which block is selected and handles intra-block scrolling when
// a block is taller than the viewport.

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

export function computeScrollTo(
  lineIndex: number,
  visibleRows: number,
  totalLines: number
): number {
  const maxOffset = Math.max(0, totalLines - visibleRows);
  const ideal = lineIndex - Math.floor(visibleRows / 2);
  return Math.max(0, Math.min(ideal, maxOffset));
}

export function useBlockNav(
  ranges: Range[],
  totalLines: number,
  visibleRows: number,
  enabled: boolean
): { cursor: number; offset: number; reset: () => void; jumpTo: (lineIndex: number, blockIndex: number) => void } {
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
  const jumpTo = (lineIndex: number, blockIndex: number) => {
    setState((prev) => ({
      cursor: Math.max(0, Math.min(blockIndex, ranges.length - 1)),
      offset: computeScrollTo(lineIndex, visibleRows, totalLines),
    }));
  };
  return { cursor: state.cursor, offset: state.offset, reset, jumpTo };
}
