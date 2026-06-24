// src/sessions.ts
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import type { Session, Block } from "./types";

const SESSIONS_DIR = path.join(process.env.HOME!, ".claude", "projects");
const HEADER_LINE_LIMIT = 50;

function isHumanTypedMessage(entry: Record<string, unknown>): boolean {
  return (
    entry.type === "user" &&
    (entry as any).origin?.kind === "human" &&
    (entry as any).promptSource === "typed" &&
    typeof (entry as any).message?.content === "string"
  );
}

export function parseLines(
  lines: string[],
  filePath: string,
  mtime: Date
): Session | null {
  const sessionId = path.basename(filePath, ".jsonl");
  let firstHuman: Record<string, unknown> | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (isHumanTypedMessage(entry)) {
      firstHuman = entry;
      break;
    }
  }

  if (!firstHuman) return null;

  const cwd = (firstHuman as any).cwd as string;
  const content = (firstHuman as any).message.content as string;

  return {
    id: sessionId,
    projectPath: cwd,
    projectName: path.basename(cwd),
    startedAt: new Date((firstHuman as any).timestamp),
    updatedAt: mtime,
    summary: content.slice(0, 80),
    turnCount: 0,
    filePath,
  };
}

export function parseSessionMetadata(filePath: string): Session | null {
  const stat = statSync(filePath);
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").slice(0, HEADER_LINE_LIMIT);
  return parseLines(lines, filePath, stat.mtime);
}

function flattenResultContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b?.type === "text" && typeof b.text === "string")
      .map((b: any) => b.text)
      .join("\n");
  }
  return "";
}

export function entriesToBlocks(
  entries: Record<string, unknown>[]
): { blocks: Block[]; turnCount: number } {
  const blocks: Block[] = [];
  const toolById = new Map<string, Extract<Block, { kind: "tool" }>>();
  let turnCount = 0;

  for (const entry of entries) {
    if (isHumanTypedMessage(entry)) {
      blocks.push({ kind: "user", text: (entry as any).message.content as string });
      turnCount++;
      continue;
    }

    if (entry.type === "assistant") {
      const content = (entry as any).message?.content;
      if (!Array.isArray(content)) continue;
      for (const b of content) {
        if (b?.type === "text") {
          const text = (b.text ?? "").trim();
          if (text) blocks.push({ kind: "assistant", text });
        } else if (b?.type === "thinking") {
          const text = (b.thinking ?? "").trim();
          if (text) blocks.push({ kind: "thinking", text });
        } else if (b?.type === "tool_use") {
          const tool: Extract<Block, { kind: "tool" }> = {
            kind: "tool",
            name: b.name,
            input: b.input ?? {},
          };
          blocks.push(tool);
          if (typeof b.id === "string") toolById.set(b.id, tool);
        }
      }
      continue;
    }

    if (entry.type === "user") {
      const content = (entry as any).message?.content;
      if (!Array.isArray(content)) continue;
      for (const b of content) {
        if (b?.type === "tool_result" && typeof b.tool_use_id === "string") {
          const tool = toolById.get(b.tool_use_id);
          if (tool) {
            tool.result = { text: flattenResultContent(b.content), isError: b.is_error === true };
          }
        }
      }
    }
  }

  return { blocks, turnCount };
}

export function loadBlocks(session: Session): { blocks: Block[]; turnCount: number } {
  const content = readFileSync(session.filePath, "utf-8");
  const entries: Record<string, unknown>[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return entriesToBlocks(entries);
}

export function loadSessions(): Session[] {
  const projectDirs = readdirSync(SESSIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(SESSIONS_DIR, d.name));

  const sessions: Session[] = [];

  for (const dir of projectDirs) {
    let files: string[];
    try {
      files = readdirSync(dir)
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => path.join(dir, f));
    } catch {
      continue;
    }
    for (const file of files) {
      const session = parseSessionMetadata(file);
      if (session) sessions.push(session);
    }
  }

  return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}
