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

// --- Content scrolling (e.g. the detail pane) -------------------------------
// Unlike computeNav (which moves a cursor and scrolls only when it leaves the
// window), this moves the viewport directly over a fixed list of lines.

export function computeScroll(
  offset: number,
  action: NavAction,
  totalLines: number,
  visibleRows: number
): number {
  const maxOffset = Math.max(0, totalLines - visibleRows);
  const clamp = (n: number) => Math.max(0, Math.min(n, maxOffset));
  const half = Math.max(1, Math.floor(visibleRows / 2));

  switch (action) {
    case "up":       return clamp(offset - 1);
    case "down":     return clamp(offset + 1);
    case "top":      return 0;
    case "bottom":   return maxOffset;
    case "halfDown": return clamp(offset + half);
    case "halfUp":   return clamp(offset - half);
  }
}

export function useScroll(
  totalLines: number,
  visibleRows: number,
  enabled: boolean
): { offset: number; reset: () => void } {
  const [offset, setOffset] = useState(0);
  const lastGTime = useRef(0);

  // Re-clamp when content or viewport size changes.
  useEffect(() => {
    const maxOffset = Math.max(0, totalLines - visibleRows);
    setOffset((prev) => Math.min(prev, maxOffset));
  }, [totalLines, visibleRows]);

  useInput(
    (input, key) => {
      if (input === "j" || key.downArrow) {
        setOffset((p) => computeScroll(p, "down", totalLines, visibleRows));
      } else if (input === "k" || key.upArrow) {
        setOffset((p) => computeScroll(p, "up", totalLines, visibleRows));
      } else if (input === "G") {
        setOffset((p) => computeScroll(p, "bottom", totalLines, visibleRows));
      } else if (input === "g") {
        const now = Date.now();
        if (now - lastGTime.current < 500) {
          setOffset(0);
          lastGTime.current = 0;
        } else {
          lastGTime.current = now;
        }
      } else if (key.ctrl && input === "d") {
        setOffset((p) => computeScroll(p, "halfDown", totalLines, visibleRows));
      } else if (key.ctrl && input === "u") {
        setOffset((p) => computeScroll(p, "halfUp", totalLines, visibleRows));
      }
    },
    { isActive: enabled }
  );

  const reset = () => setOffset(0);
  return { offset, reset };
}
