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
