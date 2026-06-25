import { blocksToLines } from "./render";
import type { Block } from "./types";
import type { Line } from "./render";

export interface Match {
  lineIndex: number;
  blockIndex: number;
  col: number;
  length: number;
}

export function compileQuery(pattern: string): RegExp | null {
  try {
    const flags = /[A-Z]/.test(pattern) ? "g" : "gi";
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

export function findMatches(lines: Line[], regex: RegExp): Match[] {
  const matches: Match[] = [];
  // Reset lastIndex before scanning (regex is global/stateful).
  for (let i = 0; i < lines.length; i++) {
    regex.lastIndex = 0;
    const text = lines[i].text;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      matches.push({
        lineIndex: i,
        blockIndex: lines[i].blockIndex,
        col: m.index,
        length: m[0].length,
      });
      // Guard against zero-length matches causing infinite loops.
      if (m[0].length === 0) regex.lastIndex++;
    }
  }
  return matches;
}

export function findBlocksMatching(blocks: Block[], width: number, regex: RegExp): Set<number> {
  // Flatten with all blocks expanded so hidden (collapsed) content is searched.
  const allExpanded = new Set(blocks.map((_, i) => i));
  const { lines } = blocksToLines(blocks, width, allExpanded);
  const matches = findMatches(lines, regex);
  return new Set(matches.map((m) => m.blockIndex));
}
