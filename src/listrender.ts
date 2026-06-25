// src/listrender.ts
// Pure builder: flatten sessions into renderable rows with date-group headers
// and per-session ranges, mirroring render.ts's blocksToLines pattern.
import type { Session } from "./types";
import { relativeTime, truncateEnd } from "./utils";

export type ListRow =
  | { kind: "header"; text: string }
  | { kind: "item-name"; sessionIndex: number; text: string }
  | { kind: "item-summary"; sessionIndex: number; text: string };

export function dateBucket(date: Date, now: Date): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.floor((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return "Older";
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

function nameLine(name: string, time: string, cw: number): string {
  if (time.length + 1 >= cw) return pad(truncateEnd(name, cw), cw);
  const n = truncateEnd(name, cw - time.length - 1);
  const gap = cw - n.length - time.length;
  return n + " ".repeat(gap) + time;
}

export function sessionsToRows(
  sessions: Session[],
  width: number,
  now: Date = new Date()
): { rows: ListRow[]; ranges: { start: number; len: number }[] } {
  const rows: ListRow[] = [];
  const ranges: { start: number; len: number }[] = [];
  // width - 2 for the component's paddingX, - 2 for the selection gutter.
  const cw = Math.max(1, width - 4);
  let lastBucket: string | null = null;

  sessions.forEach((s, i) => {
    const start = rows.length;
    const bucket = dateBucket(s.updatedAt, now);
    if (bucket !== lastBucket) {
      rows.push({ kind: "header", text: bucket });
      lastBucket = bucket;
    }
    rows.push({ kind: "item-name", sessionIndex: i, text: nameLine(s.projectName, relativeTime(s.updatedAt, now), cw) });
    rows.push({ kind: "item-summary", sessionIndex: i, text: pad(truncateEnd(`"${s.summary}"`, cw), cw) });
    ranges.push({ start, len: rows.length - start });
  });

  return { rows, ranges };
}
