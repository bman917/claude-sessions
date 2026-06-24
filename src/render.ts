// src/render.ts
// Pure helpers that flatten a conversation into renderable, scrollable lines.
import path from "path";
import type { Block } from "./types";

export interface Line {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
  blockIndex: number;
  // On a collapsible block's header line: the keybinding hint to show when the
  // block is focused (e.g. "Ctrl+O to expand"). The component decides visibility.
  hint?: string;
  // Left-gutter accent color for the line, keyed to the owning block's kind.
  accent?: string;
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

const PREVIEW_RESULT_LINES = 3;
const PREVIEW_THINKING_LINES = 2;
const SUMMARY_MAX = 60;

function truncate(s: string, n: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n - 1) + "…" : flat;
}

export function summarizeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "Bash":
      return truncate(String(input.command ?? ""), SUMMARY_MAX);
    case "Read":
    case "Edit":
    case "Write":
      return path.basename(String(input.file_path ?? ""));
    case "Grep":
    case "Glob":
      return truncate(String(input.pattern ?? ""), SUMMARY_MAX);
    case "Task":
      return truncate(String(input.description ?? ""), SUMMARY_MAX);
    default: {
      const first = Object.values(input)[0];
      return first === undefined ? "" : truncate(String(first), SUMMARY_MAX);
    }
  }
}

function expandInput(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "Bash":
      return String(input.command ?? "");
    case "Edit":
      return `- ${String(input.old_string ?? "")}\n+ ${String(input.new_string ?? "")}`;
    case "Write":
      return String(input.content ?? "");
    case "Task":
      return String(input.prompt ?? "");
    case "Read":
    case "Grep":
    case "Glob":
      return "";
    default:
      return JSON.stringify(input, null, 2);
  }
}

export function blocksToLines(
  blocks: Block[],
  width: number,
  expanded: Set<number>
): { lines: Line[]; ranges: { start: number; len: number }[] } {
  const lines: Line[] = [];
  const ranges: { start: number; len: number }[] = [];
  const body = Math.max(1, width - 2);
  const resultBody = Math.max(1, width - 4);

  blocks.forEach((block, i) => {
    const start = lines.length;
    const accent =
      block.kind === "user"
        ? "green"
        : block.kind === "assistant"
          ? "blue"
          : block.kind === "thinking"
            ? "gray"
            : block.name === "Task"
              ? "magenta"
              : "cyan";
    const push = (text: string, opts: Partial<Line> = {}) =>
      lines.push({ text, blockIndex: i, accent, ...opts });
    const isOpen = expanded.has(i);
    // Collapsible blocks (thinking/tool/Task) carry a focus-only keybinding hint
    // on their header line; the component shows it only for the focused block.
    const hint = isOpen ? "Ctrl+O to collapse" : "Ctrl+O to expand";

    if (block.kind === "user" || block.kind === "assistant") {
      const isUser = block.kind === "user";
      push(isUser ? "You" : "Claude", { color: isUser ? "green" : "blue", bold: true });
      for (const cl of wrapText(block.text, body)) push("  " + cl);
    } else if (block.kind === "thinking") {
      push("✻ Thinking", { dim: true, hint });
      const wrapped = wrapText(block.text, body);
      const shown = isOpen ? wrapped : wrapped.slice(0, PREVIEW_THINKING_LINES);
      for (const cl of shown) push("  " + cl, { dim: true });
      if (!isOpen && wrapped.length > shown.length)
        push(`  … +${wrapped.length - shown.length} more`, { dim: true });
    } else {
      const isTask = block.name === "Task";
      const summary = summarizeTool(block.name, block.input);
      if (isTask) {
        const sub = String(block.input.subagent_type ?? "agent");
        push(`◆ Task(${sub})  ${summary}`, { color: "magenta", bold: true, hint });
      } else {
        push(`▸ ${block.name}  ${summary}`, { color: "cyan", bold: true, hint });
      }

      if (isOpen) {
        const inputText = expandInput(block.name, block.input);
        if (inputText) for (const cl of wrapText(inputText, body)) push("  " + cl, { dim: true });
      }

      if (block.result) {
        const resultLines = block.result.text.split("\n");
        const status = block.result.isError ? "error" : "ok";
        push(`  └ ${status} · ${resultLines.length} lines`, {
          color: block.result.isError ? "red" : undefined,
          dim: !block.result.isError,
        });
        const shown = isOpen ? resultLines : resultLines.slice(0, PREVIEW_RESULT_LINES);
        for (const rl of shown) for (const cl of wrapText(rl, resultBody)) push("    " + cl, { dim: true });
        if (!isOpen && resultLines.length > shown.length)
          push(`    … +${resultLines.length - shown.length} more`, { dim: true });
      } else {
        push("  └ (no result)", { dim: true });
      }
    }

    push(""); // blank separator, tagged to this block
    ranges.push({ start, len: lines.length - start });
  });

  return { lines, ranges };
}
