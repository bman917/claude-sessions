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
