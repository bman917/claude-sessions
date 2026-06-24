// src/render.ts
// Pure helpers that flatten a conversation into renderable, scrollable lines.
import type { Turn } from "./types";

export interface Line {
  text: string;
  color?: string;
  bold?: boolean;
}

/**
 * Word-wrap `text` to `width` columns, preserving explicit newlines
 * (including blank lines). Words longer than `width` are hard-split.
 */
export function wrapText(text: string, width: number): string[] {
  const w = Math.max(1, width);
  const out: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/).filter((x) => x !== "")) {
      let token = word;
      // Hard-split tokens that can never fit on a line.
      while (token.length > w) {
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(token.slice(0, w));
        token = token.slice(w);
      }
      if (line === "") {
        line = token;
      } else if (line.length + 1 + token.length <= w) {
        line += " " + token;
      } else {
        out.push(line);
        line = token;
      }
    }
    out.push(line);
  }

  return out;
}

/**
 * Flatten turns into colored lines: a bold role label, the wrapped content
 * indented by two spaces, then a blank separator line between turns.
 */
export function turnsToLines(turns: Turn[], width: number): Line[] {
  const lines: Line[] = [];
  for (const turn of turns) {
    const isUser = turn.role === "user";
    lines.push({ text: isUser ? "You" : "Claude", color: isUser ? "green" : "blue", bold: true });
    for (const cl of wrapText(turn.content, width - 2)) {
      lines.push({ text: "  " + cl });
    }
    lines.push({ text: "" });
  }
  return lines;
}
