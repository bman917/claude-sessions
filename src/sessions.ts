// src/sessions.ts
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import type { Session, Turn } from "./types";

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
